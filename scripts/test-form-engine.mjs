import assert from 'node:assert/strict';

await import('../theme/assets/jill-form-engine.js');

const engine = globalThis.JILLFormEngine;
assert.ok(engine, 'JILLFormEngine must initialize');

const {STATES, validateField, validateFields, evaluateCondition, evaluateProgression} = engine;

assert.deepEqual(Object.keys(STATES), [
  'UNAVAILABLE',
  'EMPTY',
  'VALID',
  'INVALID',
  'PENDING',
  'SUCCESS',
  'ERROR',
]);

const requiredText = {
  id: 'name',
  kind: 'text',
  group: 'personalization',
  label: 'Name',
  required: true,
  maxLength: 12,
};

assert.equal(validateField(requiredText, '', {}).state, STATES.EMPTY);
assert.equal(validateField(requiredText, '   ', {}).reason, 'required');
assert.equal(validateField(requiredText, 'Mia', {}).state, STATES.VALID);
assert.equal(validateField(requiredText, '1234567890123', {}).reason, 'max_length');

const optionalText = {...requiredText, id: 'notes', required: false};
assert.equal(validateField(optionalText, '', {}).state, STATES.VALID);

const styleField = {
  id: 'style',
  kind: 'select',
  group: 'product_options',
  label: 'Style',
  required: true,
  options: [
    {value: 'number', label: 'Number'},
    {value: 'shape', label: 'Shape'},
  ],
};

assert.equal(validateField(styleField, '', {}).state, STATES.EMPTY);
assert.equal(validateField(styleField, 'character', {}).reason, 'option');
assert.equal(validateField(styleField, 'number', {}).state, STATES.VALID);

const numberField = {
  id: 'pinata_number',
  kind: 'number',
  group: 'product_options',
  label: 'Number',
  required: true,
  min: 1,
  max: 9,
  step: 1,
  visibleWhen: {
    mode: 'all',
    conditions: [{field: 'style', operator: 'equals', value: 'number'}],
  },
};

assert.equal(validateField(numberField, '', {style: 'shape'}).state, STATES.UNAVAILABLE);
assert.equal(validateField(numberField, 0, {style: 'number'}).reason, 'min');
assert.equal(validateField(numberField, 5.5, {style: 'number'}).reason, 'step');
assert.equal(validateField(numberField, 5, {style: 'number'}).state, STATES.VALID);

assert.equal(
  evaluateCondition({field: 'style', operator: 'in', value: ['number', 'shape']}, {style: 'shape'}),
  true,
);
assert.equal(
  evaluateCondition({field: 'style', operator: 'not_in', value: ['number']}, {style: 'shape'}),
  true,
);

const consentField = {
  id: 'consent',
  kind: 'checkbox',
  group: 'planning',
  label: 'Consent',
  required: true,
};
assert.equal(validateField(consentField, false, {}).state, STATES.EMPTY);
assert.equal(validateField(consentField, true, {}).state, STATES.VALID);

const dateField = {
  id: 'event_date',
  kind: 'date',
  group: 'planning',
  label: 'Event date',
  required: true,
};
assert.equal(validateField(dateField, '2026-02-30', {}).reason, 'date');
assert.equal(validateField(dateField, '2026-12-20', {}).state, STATES.VALID);

const fileField = {
  id: 'references',
  kind: 'file',
  group: 'reference',
  label: 'References',
  required: true,
  maxFiles: 2,
  accept: ['image/*', '.pdf'],
};

assert.equal(validateField(fileField, [], {}).state, STATES.EMPTY);
assert.equal(
  validateField(fileField, [{name: 'brief.pdf', type: 'application/pdf'}], {}).state,
  STATES.VALID,
);
assert.equal(
  validateField(fileField, [{name: 'notes.txt', type: 'text/plain'}], {}).reason,
  'file_type',
);
assert.equal(
  validateField(
    fileField,
    [
      {name: 'a.png', type: 'image/png'},
      {name: 'b.png', type: 'image/png'},
      {name: 'c.png', type: 'image/png'},
    ],
    {},
  ).reason,
  'file_count',
);

const fields = [styleField, numberField, requiredText];
let values = {style: 'number', pinata_number: 5, name: 'Mia'};
let validation = validateFields(fields, values);
assert.equal(validation.valid, true);
assert.equal(validation.firstInvalidId, null);

const stages = [
  {
    id: 'options',
    fieldIds: ['style', 'pinata_number'],
  },
  {
    id: 'personalization',
    requiresStages: ['options'],
    fieldIds: ['name'],
  },
];

let progression = evaluateProgression(stages, validation);
assert.equal(progression.byId.options.state, STATES.VALID);
assert.equal(progression.byId.personalization.state, STATES.VALID);
assert.equal(progression.complete, true);
assert.equal(progression.firstIncompleteStageId, null);
assert.equal(progression.firstActionableStageId, null);

values = {style: '', pinata_number: 5, name: 'Mia'};
validation = validateFields(fields, values);
progression = evaluateProgression(stages, validation);
assert.equal(validation.byId.style.state, STATES.EMPTY);
assert.equal(validation.byId.pinata_number.state, STATES.UNAVAILABLE);
assert.equal(progression.byId.options.state, STATES.EMPTY);
assert.equal(progression.byId.personalization.state, STATES.UNAVAILABLE);
assert.equal(progression.complete, false);
assert.equal(progression.firstIncompleteStageId, 'options');
assert.equal(progression.firstActionableStageId, 'options');

const externalPrerequisite = {
  id: 'entry_gate',
  kind: 'checkbox',
  group: 'planning',
  label: 'Entry gate',
  required: true,
};
const gatedValidation = validateFields([externalPrerequisite], {entry_gate: false});
const gatedProgression = evaluateProgression(
  [{id: 'gated', requiresFields: ['entry_gate'], fieldIds: []}],
  gatedValidation,
);
assert.equal(gatedProgression.byId.gated.state, STATES.UNAVAILABLE);
assert.equal(gatedProgression.complete, false);
assert.equal(gatedProgression.firstIncompleteStageId, 'gated');
assert.equal(gatedProgression.firstActionableStageId, null);

const optionalInvalid = validateFields(
  [{...optionalText, minLength: 3}],
  {notes: 'x'},
);
assert.equal(optionalInvalid.valid, false, 'an optional field with an entered invalid value must block completion');

assert.throws(
  () => validateFields([requiredText, requiredText], {name: 'Mia'}),
  /duplicate field id name/,
);

assert.throws(
  () =>
    evaluateProgression(
      [{id: 'late', requiresStages: ['missing'], fieldIds: []}],
      validateFields([], {}),
    ),
  /has not been evaluated/,
);
