import type {
  CheckTemplate,
  HouseWatcher,
  Property,
} from "../types";

export interface SeedBundle {
  houseWatchers: HouseWatcher[];
  properties: Property[];
  templates: CheckTemplate[];
}

export function buildSeed(): SeedBundle {
  const watcherId = "hw_demo_1";
  const watcherUserId = "user_watcher_1";

  const houseWatchers: HouseWatcher[] = [
    {
      id: watcherId,
      userId: watcherUserId,
      displayName: "Jamie Rivera",
      email: "jamie@example.com",
    },
  ];

  const properties: Property[] = [
    {
      id: "prop_1",
      companyId: null,
      address: "123 Main St",
      city: "Scottsdale",
      state: "AZ",
      postalCode: "85251",
      ownerId: "owner_1",
      assignedHouseWatcherId: watcherId,
      notes: "Spare key in lockbox; dog at back door — friendly.",
    },
    {
      id: "prop_2",
      companyId: null,
      address: "47 Saguaro Way",
      city: "Scottsdale",
      state: "AZ",
      postalCode: "85255",
      ownerId: "owner_2",
      assignedHouseWatcherId: watcherId,
      notes: "Pool pump has been tripping breaker — check panel first.",
    },
    {
      id: "prop_3",
      companyId: null,
      address: "901 Camelback Rd #12",
      city: "Phoenix",
      state: "AZ",
      postalCode: "85014",
      ownerId: "owner_1",
      assignedHouseWatcherId: watcherId,
      notes: null,
    },
  ];

  const templates: CheckTemplate[] = [
    {
      id: "tpl_standard_house_check",
      name: "Standard House Check",
      description: "Baseline walkthrough for a vacant residential property.",
      sections: [
        {
          id: "sec_exterior",
          templateId: "tpl_standard_house_check",
          name: "Exterior",
          order: 1,
          items: [
            {
              id: "item_ext_entry",
              sectionId: "sec_exterior",
              prompt: "Front door and locks secure?",
              order: 1,
              required: true,
              allowsPhoto: true,
              allowsNote: true,
            },
            {
              id: "item_ext_yard",
              sectionId: "sec_exterior",
              prompt: "Yard / landscaping — anything unusual?",
              order: 2,
              required: true,
              allowsPhoto: true,
              allowsNote: true,
            },
            {
              id: "item_ext_package",
              sectionId: "sec_exterior",
              prompt: "Any packages or mail accumulating?",
              order: 3,
              required: false,
              allowsPhoto: true,
              allowsNote: true,
            },
          ],
        },
        {
          id: "sec_interior",
          templateId: "tpl_standard_house_check",
          name: "Interior",
          order: 2,
          items: [
            {
              id: "item_int_temp",
              sectionId: "sec_interior",
              prompt: "Thermostat reading within expected range?",
              order: 1,
              required: true,
              allowsPhoto: true,
              allowsNote: true,
            },
            {
              id: "item_int_leaks",
              sectionId: "sec_interior",
              prompt: "Any visible leaks or water damage?",
              order: 2,
              required: true,
              allowsPhoto: true,
              allowsNote: true,
            },
            {
              id: "item_int_pests",
              sectionId: "sec_interior",
              prompt: "Signs of pests?",
              order: 3,
              required: true,
              allowsPhoto: true,
              allowsNote: true,
            },
          ],
        },
        {
          id: "sec_systems",
          templateId: "tpl_standard_house_check",
          name: "Systems",
          order: 3,
          items: [
            {
              id: "item_sys_hvac",
              sectionId: "sec_systems",
              prompt: "HVAC running normally?",
              order: 1,
              required: true,
              allowsPhoto: true,
              allowsNote: true,
            },
            {
              id: "item_sys_water",
              sectionId: "sec_systems",
              prompt: "Water main / shutoffs accessible?",
              order: 2,
              required: false,
              allowsPhoto: true,
              allowsNote: true,
            },
          ],
        },
      ],
    },
  ];

  return { houseWatchers, properties, templates };
}
