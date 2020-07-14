import {Button, Tooltip} from '@chakra-ui/core'
import {faExpand} from '@fortawesome/free-solid-svg-icons'
import {useEffect, useState} from 'react'
import {useLeaflet} from 'react-leaflet'
import {useSelector} from 'react-redux'

import selectModificationBounds from 'lib/selectors/modification-bounds'

import Icon from '../icon'

const label = 'Fit map to modification extents'

export default function FitBounds() {
  const leaflet = useLeaflet()
  const bounds = useSelector(selectModificationBounds)
  const [fitBoundsTriggered, setFitBoundsTriggered] = useState(0)

  // Zoom to bounds on a trigger or bounds change
  useEffect(() => {
    if (fitBoundsTriggered !== 0) {
      if (bounds) {
        leaflet.map.fitBounds(bounds)
      }
    }
  }, [bounds, leaflet, fitBoundsTriggered])

  return (
    <Tooltip aria-label={label} label={label} hasArrow zIndex={1000}>
      <Button
        id='zoom-to-modification'
        onClick={() => setFitBoundsTriggered(Date.now())}
        size='sm'
        variant='ghost'
        variantColor='blue'
      >
        <Icon icon={faExpand} fixedWidth={false} />
      </Button>
    </Tooltip>
  )
}
