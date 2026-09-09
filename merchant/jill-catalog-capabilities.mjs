const DIGIT_OPTIONS = Object.freeze(
  Array.from({length: 9}, (_, index) => {
    const value = String(index + 1);
    return Object.freeze({value, label: value});
  }),
);

const YES_NO_OPTIONS = Object.freeze([
  Object.freeze({value: 'yes', label: 'Yes'}),
  Object.freeze({value: 'no', label: 'No'}),
]);

const PRINT_METHOD_OPTIONS = Object.freeze([
  Object.freeze({value: 'dtf', label: 'DTF'}),
  Object.freeze({value: 'sublimation', label: 'Sublimation'}),
  Object.freeze({value: 'vinyl', label: 'Vinyl'}),
]);

function conditional(field, value) {
  return {
    mode: 'all',
    conditions: [{field, operator: 'equals', value}],
  };
}

function referenceField({required}) {
  return {
    id: 'reference_images',
    kind: 'file',
    group: 'reference',
    label: required ? 'Reference file' : 'Reference images',
    help: required
      ? 'Required — upload at least one reference. You can include up to 3 images.'
      : 'Optional — upload up to 3 images that help us understand your design.',
    required,
    accept: ['image/*'],
    maxFiles: 3,
  };
}

function partyPersonalizationFields() {
  return [
    {
      id: 'add_name',
      kind: 'radio',
      group: 'personalization',
      label: 'Would you like to add a name or text?',
      required: true,
      options: YES_NO_OPTIONS,
    },
    {
      id: 'name_text',
      kind: 'text',
      group: 'personalization',
      label: 'Name or text',
      required: true,
      maxLength: 12,
      visibleWhen: conditional('add_name', 'yes'),
    },
    {
      id: 'add_age',
      kind: 'radio',
      group: 'personalization',
      label: 'Would you like to add a number or age?',
      required: true,
      options: YES_NO_OPTIONS,
    },
    {
      id: 'age_number',
      kind: 'select',
      group: 'personalization',
      label: 'Number or age',
      required: true,
      options: DIGIT_OPTIONS,
      visibleWhen: conditional('add_age', 'yes'),
    },
    {
      id: 'theme',
      kind: 'textarea',
      group: 'personalization',
      label: 'Tell us about your theme',
      required: true,
      maxLength: 500,
    },
    {
      id: 'colors',
      kind: 'text',
      group: 'personalization',
      label: 'Preferred colors',
      required: false,
      maxLength: 200,
    },
  ];
}

function partyPackProfile({id, unitsPerQuantity, singularLabel, pluralLabel}) {
  const personalizationFieldIds = [
    'add_name',
    'name_text',
    'add_age',
    'age_number',
    'theme',
    'colors',
  ];

  return {
    version: 1,
    id,
    fields: [...partyPersonalizationFields(), referenceField({required: false})],
    features: {
      customizationUnits: {unitsPerQuantity, singularLabel, pluralLabel},
      personalizationAllocation: {
        enabled: true,
        allowedModes: ['same', 'different'],
        fieldIds: personalizationFieldIds,
      },
      referenceUpload: {enabled: true, fieldId: 'reference_images'},
    },
  };
}

function artworkProfile({id, printMethod = false}) {
  const fields = [];
  if (printMethod) {
    fields.push({
      id: 'print_method',
      kind: 'select',
      group: 'product_options',
      label: 'Print method',
      required: true,
      options: PRINT_METHOD_OPTIONS,
    });
  }

  fields.push(
    {
      id: 'name_text',
      kind: 'text',
      group: 'personalization',
      label: 'Name or text',
      required: true,
      maxLength: 12,
    },
    referenceField({required: true}),
  );

  return {
    version: 1,
    id,
    fields,
    features: {
      personalizationAllocation: {
        enabled: true,
        allowedModes: ['same', 'different'],
        fieldIds: ['name_text'],
      },
      referenceUpload: {enabled: true, fieldId: 'reference_images'},
    },
  };
}

function pinataPersonalizationFields({includeAge}) {
  const fields = [
    {
      id: 'add_name',
      kind: 'radio',
      group: 'personalization',
      label: 'Would you like to add a name or text?',
      required: true,
      options: YES_NO_OPTIONS,
    },
    {
      id: 'name_text',
      kind: 'text',
      group: 'personalization',
      label: 'Name or text',
      required: true,
      maxLength: 12,
      visibleWhen: conditional('add_name', 'yes'),
    },
  ];

  if (includeAge) {
    fields.push(
      {
        id: 'add_age',
        kind: 'radio',
        group: 'personalization',
        label: 'Would you like to add a number or age?',
        required: true,
        options: YES_NO_OPTIONS,
      },
      {
        id: 'age_number',
        kind: 'select',
        group: 'personalization',
        label: 'Number or age',
        required: true,
        options: DIGIT_OPTIONS,
        visibleWhen: conditional('add_age', 'yes'),
      },
    );
  }

  fields.push(
    {
      id: 'theme',
      kind: 'textarea',
      group: 'personalization',
      label: 'Tell us about your theme',
      required: true,
      maxLength: 500,
    },
    {
      id: 'colors',
      kind: 'text',
      group: 'personalization',
      label: 'Preferred colors',
      required: false,
      maxLength: 200,
    },
  );
  return fields;
}

function pinataProfile({id, round = false}) {
  const fields = [];
  if (!round) {
    fields.push(
      {
        id: 'pinata_style',
        kind: 'select',
        group: 'product_options',
        label: 'Piñata style',
        required: true,
        options: [
          {value: 'number', label: 'Number'},
          {value: 'shape', label: 'Shape'},
          {value: 'character', label: 'Character'},
        ],
      },
      {
        id: 'pinata_number',
        kind: 'select',
        group: 'product_options',
        label: 'Number',
        required: true,
        options: DIGIT_OPTIONS,
        visibleWhen: conditional('pinata_style', 'number'),
      },
      {
        id: 'shape_details',
        kind: 'textarea',
        group: 'product_options',
        label: 'Describe the shape',
        required: true,
        maxLength: 200,
        visibleWhen: conditional('pinata_style', 'shape'),
      },
      {
        id: 'character_details',
        kind: 'textarea',
        group: 'product_options',
        label: 'Which character or custom design?',
        required: true,
        maxLength: 200,
        visibleWhen: conditional('pinata_style', 'character'),
      },
    );
  }

  fields.push(
    {
      id: 'opening_style',
      kind: 'select',
      group: 'product_options',
      label: 'How should it open?',
      required: true,
      options: [
        {value: 'traditional', label: 'Traditional break'},
        {value: 'pull_string', label: 'Pull-string'},
      ],
    },
    ...pinataPersonalizationFields({includeAge: round}),
    referenceField({required: false}),
  );

  const personalizationFieldIds = ['add_name', 'name_text'];
  if (round) personalizationFieldIds.push('add_age', 'age_number');
  personalizationFieldIds.push('theme', 'colors');

  return {
    version: 1,
    id,
    fields,
    features: {
      customizationUnits: {
        unitsPerQuantity: 1,
        singularLabel: 'piñata',
        pluralLabel: 'piñatas',
      },
      personalizationAllocation: {
        enabled: true,
        allowedModes: ['same', 'different'],
        fieldIds: personalizationFieldIds,
      },
      referenceUpload: {enabled: true, fieldId: 'reference_images'},
    },
  };
}

function snackBagProfile() {
  const profile = partyPackProfile({
    id: 'jill_snack_bags_12',
    unitsPerQuantity: 12,
    singularLabel: 'bag',
    pluralLabel: 'bags',
  });

  profile.fields = [
    {
      id: 'fill_state',
      kind: 'radio',
      group: 'product_options',
      label: 'Filled or Empty',
      required: true,
      options: [
        {value: 'empty', label: 'Empty'},
        {value: 'filled', label: 'Filled'},
      ],
    },
    {
      id: 'snack_choice',
      kind: 'select',
      group: 'product_options',
      label: 'Snack choice',
      required: true,
      options: [
        {value: 'lays_classic', label: 'Lay’s Classic'},
        {value: 'cheetos_crunchy_cheese', label: 'Cheetos Crunchy Cheese'},
        {value: 'fritos_original', label: 'Fritos Original'},
        {value: 'doritos_nacho_cheese', label: 'Doritos Nacho Cheese'},
        {value: 'doritos_cool_ranch', label: 'Doritos Cool Ranch'},
        {value: 'mixed', label: 'Mixed'},
        {value: 'other', label: 'Other'},
      ],
      visibleWhen: conditional('fill_state', 'filled'),
    },
    {
      id: 'other_snack_detail',
      kind: 'text',
      group: 'product_options',
      label: 'Which snack would you like?',
      required: true,
      maxLength: 200,
      visibleWhen: conditional('snack_choice', 'other'),
    },
    ...profile.fields,
  ];
  profile.features.productOptionsAllocation = {
    fieldIds: ['fill_state', 'snack_choice', 'other_snack_detail'],
  };
  return profile;
}

export const JILL_CATALOG_CAPABILITIES = Object.freeze([
  Object.freeze({
    productId: 'gid://shopify/Product/9552565797107',
    handle: 'custom-coffee-mug-photo-sublimation-74734',
    title: 'Custom 11 oz Coffee Mug – Personalized Print',
    profile: artworkProfile({id: 'jill_mug_11oz'}),
  }),
  Object.freeze({
    productId: 'gid://shopify/Product/9552566092019',
    handle: 'cake-toppers-1x-large-12x-small-91117',
    title: 'Custom Cake Topper Set – 13 Pieces – Made to Order',
    profile: partyPackProfile({id: 'jill_cake_topper_set_13', unitsPerQuantity: 1, singularLabel: 'set', pluralLabel: 'sets'}),
  }),
  Object.freeze({
    productId: 'gid://shopify/Product/9552565403891',
    handle: 'party-favors-coloring-books-custom-08343',
    title: 'Custom Coloring Books – 12 Count – Personalized Party Favors',
    profile: partyPackProfile({id: 'jill_coloring_books_12', unitsPerQuantity: 12, singularLabel: 'book', pluralLabel: 'books'}),
  }),
  Object.freeze({
    productId: 'gid://shopify/Product/9552566386931',
    handle: 'custom-dtf-crewneck-fleece-for-your-crew-48791',
    title: 'Custom DTF Crewneck Sweatshirt – Made to Order',
    profile: artworkProfile({id: 'jill_crewneck', printMethod: true}),
  }),
  Object.freeze({
    productId: 'gid://shopify/Product/9552566976755',
    handle: 'custom-dtf-hoodie-for-your-crew-21083',
    title: 'Custom DTF Hoodie – Made to Order',
    profile: artworkProfile({id: 'jill_hoodie', printMethod: true}),
  }),
  Object.freeze({
    productId: 'gid://shopify/Product/9552565928179',
    handle: 'custom-dtf-t-shirts-for-your-crew-67138',
    title: 'Custom DTF T-Shirt – Made to Order',
    profile: artworkProfile({id: 'jill_tshirt', printMethod: true}),
  }),
  Object.freeze({
    productId: 'gid://shopify/Product/9552565534963',
    handle: 'pinata-custom-theme-13-inches-round-96685',
    title: 'Custom Handmade Piñata – 13 Inch Round',
    profile: pinataProfile({id: 'jill_pinata_13_round', round: true}),
  }),
  Object.freeze({
    productId: 'gid://shopify/Product/9552567140595',
    handle: 'pinata-custom-theme-all-ages-18-71638',
    title: 'Custom Handmade Piñata – 18 Inch',
    profile: pinataProfile({id: 'jill_pinata_18'}),
  }),
  Object.freeze({
    productId: 'gid://shopify/Product/9552565633267',
    handle: 'pinata-with-stick-custom-theme-all-87524',
    title: 'Custom Handmade Piñata – 18 Inch – Includes Stick',
    profile: pinataProfile({id: 'jill_pinata_18_stick'}),
  }),
  Object.freeze({
    productId: 'gid://shopify/Product/9552565141747',
    handle: 'pinata-custom-theme-includes-stick-76338',
    title: 'Custom Handmade Piñata – 36 Inch – Includes Stick',
    profile: pinataProfile({id: 'jill_pinata_36_stick'}),
  }),
  Object.freeze({
    productId: 'gid://shopify/Product/9552565272819',
    handle: 'party-favors-coloring-box-activity-60610',
    title: 'Custom Kids Activity Kit with Play-Doh – 8 Count',
    profile: partyPackProfile({id: 'jill_activity_kit_8', unitsPerQuantity: 8, singularLabel: 'kit', pluralLabel: 'kits'}),
  }),
  Object.freeze({
    productId: 'gid://shopify/Product/9552566714611',
    handle: 'party-favors-snack-bags-custom-theme-99329',
    title: 'Custom Party Favor Snack Bags – 12 Count',
    profile: snackBagProfile(),
  }),
  Object.freeze({
    productId: 'gid://shopify/Product/9552566223091',
    handle: 'party-favors-surprise-bags-custom-35779',
    title: 'Custom Party Favor Surprise Bags – 12 Count',
    profile: partyPackProfile({id: 'jill_surprise_bags_12', unitsPerQuantity: 12, singularLabel: 'bag', pluralLabel: 'bags'}),
  }),
  Object.freeze({
    productId: 'gid://shopify/Product/9552566583539',
    handle: 'party-favors-surprise-box-custom-05087',
    title: 'Custom Party Favor Surprise Boxes – 12 Count',
    profile: partyPackProfile({id: 'jill_surprise_boxes_12', unitsPerQuantity: 12, singularLabel: 'box', pluralLabel: 'boxes'}),
  }),
  Object.freeze({
    productId: 'gid://shopify/Product/9616737992947',
    handle: 'tote-bag-vinyl-transfer-custom',
    title: 'Personalized Tote Bag – Custom Photo, Text & Design',
    profile: artworkProfile({id: 'jill_tote_bag'}),
  }),
]);

export function getJillCatalogCapabilityByHandle(handle) {
  return JILL_CATALOG_CAPABILITIES.find((entry) => entry.handle === handle) || null;
}
