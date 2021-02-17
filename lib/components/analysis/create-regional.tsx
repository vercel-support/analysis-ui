import {
  Button,
  FormControl,
  FormLabel,
  Input,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalHeader,
  ModalFooter,
  ModalOverlay,
  useDisclosure,
  FormHelperText,
  Stack,
  Alert,
  AlertIcon,
  AlertDescription,
  Radio,
  RadioGroup,
  Text,
  Divider,
  useToast,
  PseudoBox
} from '@chakra-ui/core'
import fpGet from 'lodash/fp/get'
import get from 'lodash/get'
import sort from 'lodash/sortBy'
import {useCallback, useState} from 'react'
import {useSelector} from 'react-redux'

import {API} from 'lib/constants'
import useInput from 'lib/hooks/use-controlled-input'
import message from 'lib/message'
import {
  activeOpportunityDataset,
  opportunityDatasets as selectOpportunityDatasets
} from 'lib/modules/opportunity-datasets/selectors'
import {versionToNumber} from 'lib/modules/r5-version/utils'
import selectCurrentRegionId from 'lib/selectors/current-region-id'
import selectMaxTripDurationMinutes from 'lib/selectors/max-trip-duration-minutes'
import selectTravelTimePercentile from 'lib/selectors/travel-time-percentile'
import authenticatedFetch from 'lib/utils/auth-fetch'

import Select from '../select'
import DocsLink from '../docs-link'
import useRouteTo from 'lib/hooks/use-route-to'

// For react-select options
const getId = fpGet('_id')

// Combine the source name with the name
const getFullODName = (od) => `${od.sourceName}: ${od.name}`

const testContent = (s) => s && s.length > 0

const defaultCutoffs = [20, 30, 45, 60]
const defaultPercentiles = [5, 25, 50, 75, 95]

const parseStringAsIntArray = (s) =>
  Array.isArray(s) ? s : sort((s || '').split(',').map((s) => Number(s)))

const createTestArray = (min, max) => (sorted) =>
  sorted.every((s) => Number.isInteger(s)) &&
  sorted[0] >= min &&
  sorted[sorted.length - 1] <= max

const onlyDigits = (s) => /^\d+$/.test(s)
const testCutoffs = createTestArray(5, 120)
const testPercentiles = createTestArray(1, 99)
const testCutoff = (c, o) => onlyDigits(o) && c >= 5 && c <= 120
const testPercentile = (p, o) => onlyDigits(o) && p >= 1 && p <= 99

const disabledLabel = 'Fetch results with the current settings to enable button'

export default function CreateRegional({
  isDisabled,
  profileRequest,
  projectId,
  variantIndex
}) {
  const {isOpen, onOpen, onClose} = useDisclosure()
  return (
    <>
      <Button
        isDisabled={isDisabled}
        onClick={onOpen}
        rightIcon='small-add'
        title={isDisabled ? disabledLabel : 'Regional analysis'}
        variantColor='green'
      >
        Regional analysis
      </Button>
      {isOpen && (
        <CreateModal
          onClose={onClose}
          profileRequest={profileRequest}
          projectId={projectId}
          variantIndex={variantIndex}
        />
      )}
    </>
  )
}

/**
 * Show this toast when a modification has been copied.
 */
function CreatedRegionalToast({onClose, regionId}) {
  const goToRegionalAnalyses = useRouteTo('regionalAnalyses', {
    regionId
  })

  return (
    <Alert
      status='success'
      variant='solid'
      mt={2}
      cursor='pointer'
      onClick={() => {
        goToRegionalAnalyses()
        onClose()
      }}
    >
      <AlertIcon />
      <AlertDescription>
        <PseudoBox _hover={{textDecoration: 'underline'}}>
          Regional analysis has been created successfully. Click here to view
          progress.
        </PseudoBox>
      </AlertDescription>
    </Alert>
  )
}

function CreateModal({onClose, profileRequest, projectId, variantIndex}) {
  const toast = useToast()
  const [error, setError] = useState<string | null>(null)
  const [isCreating, setIsCreating] = useState(false)
  const opportunityDatasets = useSelector(selectOpportunityDatasets)
  const selectedOpportunityDataset = useSelector(activeOpportunityDataset)
  const [originType, setOriginType] = useState('grid')
  const [originPointSetId, setOriginPointSetId] = useState<string | null>(null)
  const [destinationPointSets, setDestinationPointSets] = useState(
    selectedOpportunityDataset ? [selectedOpportunityDataset._id] : []
  )
  const regionId = useSelector(selectCurrentRegionId)
  const maxTripDurationMinutes = useSelector(selectMaxTripDurationMinutes)
  const travelTimePercentile = useSelector(selectTravelTimePercentile)
  const workerVersion = get(profileRequest, 'workerVersion', '')
  const workerVersionHandlesMultipleDimensions: any =
    versionToNumber(workerVersion) > 50900 ||
    (workerVersion.length == 7 && workerVersion.indexOf('.') == -1)

  const nameInput = useInput({test: testContent, value: ''})

  const onChangeOriginPointSetId = useCallback(
    (dataset) => {
      setOriginPointSetId(dataset?._id)
    },
    [setOriginPointSetId]
  )

  const onChangeDestinationPointSets = useCallback(
    (datasets) => {
      if (!datasets || datasets.length > 6) return
      if (Array.isArray(datasets))
        setDestinationPointSets(datasets.map((d) => d._id))
      else setDestinationPointSets([datasets._id]) // single selection mode
    },
    [setDestinationPointSets]
  )

  const cutoffsInput = useInput({
    parse: parseStringAsIntArray,
    test: testCutoffs,
    value: get(profileRequest, 'cutoffsMinutes', defaultCutoffs)
  })

  const percentilesInput = useInput({
    parse: parseStringAsIntArray,
    test: testPercentiles,
    value: get(profileRequest, 'percentiles', defaultPercentiles)
  })

  const cutoffInput = useInput({
    parse: parseInt,
    test: testCutoff,
    value: maxTripDurationMinutes
  })

  const percentileInput = useInput({
    parse: parseInt,
    test: testPercentile,
    value: travelTimePercentile
  })

  async function create() {
    setIsCreating(true)
    const cutoffsMinutes = workerVersionHandlesMultipleDimensions
      ? parseStringAsIntArray(cutoffsInput.value)
      : [parseInt(cutoffInput.value)]
    const percentiles = workerVersionHandlesMultipleDimensions
      ? parseStringAsIntArray(percentilesInput.value)
      : [parseInt(percentileInput.value)]

    const options = {
      ...profileRequest,
      cutoffsMinutes,
      destinationPointSetIds: destinationPointSets,
      originPointSetId,
      name: nameInput.value,
      percentiles,
      projectId,
      variantIndex
    }

    const response = await authenticatedFetch(API.Regional, {
      method: 'POST',
      body: JSON.stringify(options)
    })

    if (response.ok) {
      // Close modal first
      onClose()

      // Then show the toast
      toast({
        position: 'top',
        render: ({onClose}) => (
          <CreatedRegionalToast onClose={onClose} regionId={regionId} />
        )
      })
    } else {
      console.error(response)
      setIsCreating(false)
      if (response.data instanceof Error) {
        setError(response.data.message)
      } else {
        setError(response.problem)
      }
    }
  }

  const createDisabled =
    nameInput.isInvalid ||
    cutoffsInput.isInvalid ||
    percentilesInput.isInvalid ||
    cutoffInput.isInvalid ||
    percentileInput.isInvalid ||
    destinationPointSets.length < 1

  return (
    <Modal
      closeOnOverlayClick={false}
      initialFocusRef={nameInput.ref}
      isOpen={true}
      onClose={onClose}
      size='lg'
    >
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>
          Create new regional analysis{' '}
          <DocsLink to='analysis/regional#starting-a-regional-analysis' />
        </ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          <Stack mb={4} spacing={4}>
            {error && (
              <Alert status='error'>
                <AlertIcon />
                <AlertDescription>
                  Error creating regional analysis. {error}
                </AlertDescription>
              </Alert>
            )}
            <FormControl
              isDisabled={isCreating}
              mb={4}
              isRequired
              isInvalid={nameInput.isInvalid}
            >
              <FormLabel htmlFor={nameInput.id}>
                Regional analysis name
              </FormLabel>
              <Input {...nameInput} />
            </FormControl>

            <RadioGroup
              isInline
              onChange={(e) => {
                const type = e.target.value
                setOriginType(type)
                if (type === 'grid') setOriginPointSetId(null)
              }}
              value={originType}
            >
              <Text>Origins from </Text>
              <Radio value='grid'>Full Region</Radio>
              <Radio value='pointSet'>Point Set</Radio>
            </RadioGroup>

            {originType === 'pointSet' && (
              <FormControl isDisabled={isCreating}>
                <div>
                  <Select
                    isClearable
                    isDisabled={isCreating}
                    getOptionLabel={getFullODName}
                    getOptionValue={getId}
                    inputId='originPointSetId'
                    onChange={onChangeOriginPointSetId}
                    options={opportunityDatasets.filter(
                      (od) => od.format === 'FREEFORM'
                    )}
                    value={opportunityDatasets.find(
                      ({_id}) => _id === originPointSetId
                    )}
                  />
                </div>
              </FormControl>
            )}

            <Divider />

            <FormControl
              isDisabled={isCreating}
              isRequired
              isInvalid={
                destinationPointSets.length > 6 ||
                destinationPointSets.length === 0
              }
            >
              <FormLabel htmlFor='destinationPointSets'>
                Opportunity dataset
                {workerVersionHandlesMultipleDimensions ? '(s)' : ''}
              </FormLabel>
              <div>
                <Select
                  isClearable={false}
                  isDisabled={isCreating}
                  getOptionLabel={getFullODName}
                  getOptionValue={getId}
                  inputId='destinationPointSets'
                  isMulti={workerVersionHandlesMultipleDimensions}
                  onChange={onChangeDestinationPointSets}
                  options={opportunityDatasets}
                  value={
                    opportunityDatasets.filter((o) =>
                      destinationPointSets.includes(o._id)
                    ) as any
                  }
                />
              </div>
              {workerVersionHandlesMultipleDimensions && (
                <FormHelperText>Select up to 6 datasets.</FormHelperText>
              )}
            </FormControl>

            <Divider />
          </Stack>

          {workerVersionHandlesMultipleDimensions ? (
            <Stack isInline spacing={4}>
              <Stack spacing={4}>
                <FormControl
                  isDisabled={isCreating}
                  isRequired
                  isInvalid={cutoffsInput.isInvalid}
                >
                  <FormLabel htmlFor={cutoffsInput.id}>
                    Cutoff minutes
                  </FormLabel>
                  <Input
                    {...cutoffsInput}
                    value={
                      Array.isArray(cutoffsInput.value)
                        ? cutoffsInput.value.join(', ')
                        : cutoffsInput.value
                    }
                  />
                  <FormHelperText>From 5 to 120.</FormHelperText>
                </FormControl>
              </Stack>
              <Stack spacing={4}>
                <FormControl
                  isDisabled={isCreating}
                  isRequired
                  isInvalid={percentilesInput.isInvalid}
                >
                  <FormLabel htmlFor={percentilesInput.id}>
                    Percentiles
                  </FormLabel>
                  <Input
                    {...percentilesInput}
                    value={
                      Array.isArray(percentilesInput.value)
                        ? percentilesInput.value.join(', ')
                        : percentilesInput.value
                    }
                  />
                  <FormHelperText>From 1 to 99.</FormHelperText>
                </FormControl>
              </Stack>
            </Stack>
          ) : (
            <Stack isInline spacing={4}>
              <Stack spacing={4}>
                <FormControl
                  isDisabled={isCreating}
                  isRequired
                  isInvalid={cutoffInput.isInvalid}
                >
                  <FormLabel htmlFor={cutoffInput.id}>Cutoff minute</FormLabel>
                  <Input {...cutoffInput} />
                  <FormHelperText>From 5 to 120.</FormHelperText>
                </FormControl>
              </Stack>
              <Stack spacing={4}>
                <FormControl
                  isDisabled={isCreating}
                  isRequired
                  isInvalid={percentileInput.isInvalid}
                >
                  <FormLabel htmlFor={percentileInput.id}>Percentile</FormLabel>
                  <Input {...percentileInput} />
                  <FormHelperText>From 1 to 99.</FormHelperText>
                </FormControl>
              </Stack>
            </Stack>
          )}
        </ModalBody>
        <ModalFooter>
          <Button
            leftIcon='small-add'
            loadingText='Creating'
            isLoading={isCreating}
            isDisabled={createDisabled}
            mr={3}
            onClick={create}
            variantColor='green'
          >
            {message('common.create')}
          </Button>
          <Button isDisabled={isCreating} onClick={onClose}>
            Cancel
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  )
}
