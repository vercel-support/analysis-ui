/** Display patterns on the map */

import { Path } from 'react-leaflet'
import { geoJson, featureGroup } from 'leaflet'
import colors from '../colors'

export default class PatternLayer extends Path {
  static defaultProps = {
    color: colors.NEUTRAL
  };

  componentWillMount () {
    super.componentWillMount()
    this.leafletElement = featureGroup()
  }

  getPatterns () {
    let feed = this.props.data.feeds.get(this.props.modification.feed)

    // data has not loaded
    if (feed === undefined) return null

    // route has not yet been chosen
    if (this.props.modification.routes == null) return null

    let patterns = feed.routes.get(this.props.modification.routes[0]).patterns

    // data has not loaded
    if (patterns === undefined) return null

    // some modification types (convert-to-frequency) don't have trips/patterns specified at the modification
    // level, so .trips is undefined, not null
    if (this.props.modification.trips !== null && this.props.modification.type !== 'convert-to-frequency') {
      patterns = patterns.filter((pat) => pat.trips.findIndex((t) => this.props.modification.trips.indexOf(t.trip_id) > -1) > -1)
    }

    return patterns
  }

  render () {
    let ret = super.render()

    this.leafletElement.clearLayers()

    let patterns = this.getPatterns()

    // data not yet loaded
    if (patterns === null) return ret

    let geometry = {
      type: 'FeatureCollection',
      features: patterns.map((pat) => {
        return {
          type: 'Feature',
          geometry: pat.geometry
        }
      })
    }

    this.leafletElement.addLayer(geoJson(geometry, {
      style: {
        color: this.props.color,
        weight: 3
      }
    }))

    return ret
  }
}