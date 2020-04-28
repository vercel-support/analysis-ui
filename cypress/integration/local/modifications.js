describe('Modifications', () => {
  before(() => {
    cy.setupProject('scratch')
  })

  beforeEach(() => {
    cy.fixture('regions/scratch.json').as('region')
    cy.navTo(/Edit Modifications/)
  })

  it('can be created, saved, and deleted', () => {
    // create an arbitrary modification type
    // these actions should be the same across all types
    // TODO the types that are commented out are producing errors locally
    let mods = [
      'Add Trip Pattern',
      //'Adjust Dwell Time',
      'Adjust Speed',
      //'Convert To Frequency',
      //'Remove Stops',
      'Remove Trips',
      'Reroute',
      'Custom'
    ]
    let modType = mods[Math.floor(Math.random() * mods.length)]
    let modName = 'tempMod ' + Date.now()
    cy.findByRole('link', {name: 'Create a modification'}).click()
    cy.findByLabelText(/Modification type/i).select(modType)
    cy.findByLabelText(/Modification name/i).type(modName)
    cy.findByRole('link', {name: 'Create'}).click()
    cy.location('pathname').should('match', /.*\/modifications\/.{24}$/)
    cy.contains(modName)
    cy.findByRole('link', {name: /Add description/}).click()
    cy.findByLabelText('Description').type('descriptive text')
    // go back and see if it saved
    cy.navTo(/Edit Modifications/)
    // find the container for this modification type and open it if need be
    cy.contains(modType)
      .parent()
      .as('modList')
      .then((modList) => {
        if (!modList.text().includes(modName)) {
          cy.get(modList).click()
        }
      })
    cy.get('@modList').contains(modName).click()
    cy.location('pathname').should('match', /.*\/modifications\/.{24}$/)
    cy.contains(modName)
    cy.findByLabelText('Description').contains('descriptive text')
    // delete it
    cy.get('a[name="Delete modification"]').click()
    cy.location('pathname').should('match', /.*\/projects\/.{24}$/)
    cy.contains('Create a modification')
    cy.findByText(modName).should('not.exist')
  })

  context('new trip patterns', () => {
    it('can be imported from shapefile', function () {
      cy.get('svg[data-icon="upload"]').click()
      cy.location('pathname').should('match', /import-modifications$/)
      // TODO need better selector for button
      cy.get('a.btn').get('svg[data-icon="upload"]').click()
      cy.location('pathname').should('match', /\/import-shapefile/)
      cy.fixture(this.region.importRoutes.shapefile).then((fileContent) => {
        cy.findByLabelText(/Select Shapefile/i).upload({
          fileContent,
          fileName: this.region.importRoutes.shapefile,
          mimeType: 'application/octet-stream',
          encoding: 'base64'
        })
      })
      cy.findByLabelText(/Name/).select(this.region.importRoutes.nameField)
      cy.findByLabelText(/Frequency/).select(
        this.region.importRoutes.frequencyField
      )
      cy.findByLabelText(/Speed/).select(this.region.importRoutes.speedField)
      cy.findByText(/Import/)
        .should('not.be.disabled')
        .click()
      cy.location('pathname').should('match', /projects\/.{24}$/)
      let newRouteName = this.region.importRoutes.routeNames[0]
      cy.contains('Add Trip Pattern')
        .parent()
        .as('modList')
        .then((modList) => {
          if (!modList.text().includes(newRouteName)) {
            cy.get(modList).click()
          }
        })
      this.region.importRoutes.routeNames.forEach((name) => {
        cy.get('@modList').contains(name)
      })
      // TODO cleanup needed
    })

    it('can be drawn on map', function () {
      let modName = Date.now() + ''
      cy.setupModification('scratch', 'Add Trip Pattern', modName)
      cy.findByText(/Edit route geometry/i)
        .click()
        .contains(/Stop editing/i)
      cy.get('div.leaflet-container').as('map')
      cy.window().then((win) => {
        let map = win.LeafletMap
        let L = win.L
        let route = L.polyline(this.region.newRoute)
        // TODO fitBounds seems to mess up the lat/lon -> pix projections
        //route.addTo(map)
        //map.fitBounds( route.getBounds() )
        // click at the coordinates
        route.getLatLngs().forEach((point) => {
          let pix = map.latLngToContainerPoint(point)
          cy.get('@map').click(pix.x, pix.y)
        })
      })
      cy.findByText(/Stop editing/i)
        .click()
        .contains(/Edit route geometry/i)
      cy.get('a[name="Delete modification"]').click()
    })

    it('can create and reuse timetables', function () {
      let modName = 'timetable templates'
      let modType = 'Add Trip Pattern'
      cy.setupModification('scratch', modType, modName)
      cy.findByText(/Add new timetable/).click()
      cy.findByText(/Timetable 1/).click()
      cy.get('input[name="Name"]').clear().type('Weekday')
      cy.findByLabelText(/Mon/).check()
      cy.findByLabelText(/Tue/).check()
      cy.findByLabelText(/Wed/).check()
      cy.findByLabelText(/Thu/).check()
      cy.findByLabelText(/Fri/).check()
      cy.findByLabelText(/Sat/).uncheck()
      cy.findByLabelText(/Sun/).uncheck()
      // TODO these selectors not working
      //cy.findByLabelText(/Frequency/).clear().type('00:20:00')
      //cy.findByLabelText(/Start time/).clear().type('06:00')
      //cy.findByLabelText(/End time/).clear().type('23:00')
      //cy.findByLabelText(/dwell time/).clear().type('00:30:00')
      // exit and create new mod to copy into
      cy.setupModification('scratch', modType, 'temp')
      cy.findByText(/Copy existing timetable/).click()
      cy.findByRole('dialog').as('dialog')
      cy.get('@dialog')
        .findByLabelText(/Region/)
        .select('scratch')
      cy.get('@dialog')
        .findByLabelText(/Project/)
        .select('scratch project')
      cy.get('@dialog')
        .findByLabelText(/Modification/)
        .select(modName)
      cy.get('@dialog')
        .findByLabelText(/Timetable/)
        .select('Weekday')
      cy.findByText(/Copy into new timetable/i).click()
      cy.contains(/copy of Weekday/i).click()
      // verify the settings from above
      cy.findByLabelText(/Mon/).should('be.checked')
      cy.findByLabelText(/Tue/).should('be.checked')
      cy.findByLabelText(/Wed/).should('be.checked')
      cy.findByLabelText(/Thu/).should('be.checked')
      cy.findByLabelText(/Fri/).should('be.checked')
      cy.findByLabelText(/Sat/).should('not.be.checked')
      cy.findByLabelText(/Sun/).should('not.be.checked')
      // delete the temp modification
      cy.get('a[name="Delete modification"]').click()
      // delete the template modification
      cy.contains(modType)
        .parent()
        .as('modList')
        .then((modList) => {
          if (!modList.text().includes(modName)) {
            cy.get(modList).click()
          }
        })
      cy.findByText(modName).click()
      cy.get('a[name="Delete modification"]').click()
    })
  })

  context('Adjust dwell time', () => {
    it('has working form elements', () => {
      let modName = Date.now() + ''
      cy.setupModification('scratch', 'Adjust Dwell Time', modName)
      cy.findByLabelText(/Select feed/)
        .click({force: true})
        .type('Northern Kentucky{enter}')
      cy.findByLabelText(/Select route/)
        .click({force: true})
        .type('Taylor Mill{enter}')
      cy.findByLabelText(/Select patterns/i)
      cy.findByLabelText(/Scale existing dwell times/i).check()
      cy.findByLabelText(/Set new dwell time to/i).check()
      cy.get('a[name="Delete modification"]').click()
    })
  })

  context('Adjust speed', () => {
    it('has working form elements', () => {
      let modName = Date.now() + ''
      cy.setupModification('scratch', 'Adjust Speed', modName)
      cy.findByLabelText(/Select feed/)
        .click({force: true})
        .type('Northern Kentucky{enter}')
      cy.findByLabelText(/Select route/)
        .click({force: true})
        .type('Taylor Mill{enter}')
      cy.findByLabelText(/Select patterns/i)
      cy.get('a[name="Delete modification"]').click()
    })
  })

  context('Convert to frequency', () => {
    it('has working form elements', () => {
      let modName = Date.now() + ''
      cy.setupModification('scratch', 'Convert To Frequency', modName)
      cy.findByLabelText(/Select feed/)
        .click({force: true})
        .type('Northern Kentucky{enter}')
      cy.findByLabelText(/Select route/)
        .click({force: true})
        .type('Taylor Mill{enter}')
      cy.findByLabelText(/retain existing scheduled trips/i).check()
      cy.findByText(/Add frequency entry/i).click()
      cy.findByLabelText(/Select patterns/i)
      //cy.findByLabelText(/Frequency/i)
      //cy.findByLabelText(/Start time/i)
      //cy.findByLabelText(/End time/i)
      //cy.findByLabelText(/Phase at stop/i)
      cy.findByText(/Delete frequency entry/i).click()
      cy.get('a[name="Delete modification"]').click()
    })
  })

  context('Remove stops', () => {
    it('has working form elements', () => {
      let modName = Date.now() + ''
      cy.setupModification('scratch', 'Remove Stops', modName)
      cy.findByLabelText(/Select feed/)
        .click({force: true})
        .type('Northern Kentucky{enter}')
      cy.findByLabelText(/Select route/)
        .click({force: true})
        .type('Taylor Mill{enter}')
      cy.findByLabelText(/Select patterns/i)
      cy.findByLabelText(/Time savings per removed stop/i)
      cy.get('a[name="Delete modification"]').click()
    })
  })

  context('Remove trips', () => {
    it('has working form elements', () => {
      let modName = Date.now() + ''
      cy.setupModification('scratch', 'Remove Trips', modName)
      cy.findByLabelText(/Select feed/)
        .click({force: true})
        .type('Northern Kentucky{enter}')
      cy.findByLabelText(/Select route/)
        .click({force: true})
        .type('Taylor Mill{enter}')
      cy.findByLabelText(/Select patterns/i)
      cy.get('a[name="Delete modification"]').click()
    })
  })

  context('Reroute', () => {
    it('has working form elements', () => {
      let modName = Date.now() + ''
      cy.setupModification('scratch', 'Reroute', modName)
      cy.findByLabelText(/Select feed/)
        .click({force: true})
        .type('Northern Kentucky{enter}')
      cy.findByLabelText(/Select route/)
        .click({force: true})
        .type('Taylor Mill{enter}')
      // verify existence only
      cy.findByLabelText(/Select patterns/i)
      cy.findByText(/Start of reroute/i)
      cy.findByText(/End of reroute/i)
      //cy.findByLabelText(/Default dwell time/i)
      cy.findByLabelText(/Average speed/i)
      //cy.findByLabelText(/Total moving time/i)
      cy.get('a[name="Delete modification"]').click()
    })
  })
})
