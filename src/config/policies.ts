/**
 * Typical store return policies and manufacturer warranties.
 *
 * These are only suggestions: policies differ by item, membership and season,
 * and they change. The app always shows the suggested date for the user to
 * confirm or edit, and says where it came from. Tune or extend the list here.
 */

export type CategoryId =
  | 'electronics'
  | 'computer'
  | 'phone'
  | 'tv'
  | 'appliance'
  | 'kitchen'
  | 'tools'
  | 'furniture'
  | 'clothing'
  | 'shoes'
  | 'beauty'
  | 'toys'
  | 'sports'
  | 'home'
  | 'grocery'
  | 'other';

export interface Category {
  id: CategoryId;
  label: string;
  /** Typical manufacturer warranty, in months (0 = none). */
  warrantyMonths: number;
  /** Counts as electronics for stores with a shorter electronics window. */
  electronics?: boolean;
  /** Lowercase keywords matched against item names. */
  keywords: string[];
}

export const CATEGORIES: Category[] = [
  {
    id: 'phone',
    label: 'Phone or tablet',
    warrantyMonths: 12,
    electronics: true,
    keywords: ['iphone', 'ipad', 'galaxy', 'pixel', 'phone', 'tablet', 'kindle', 'smartwatch', 'apple watch'],
  },
  {
    id: 'computer',
    label: 'Computer',
    warrantyMonths: 12,
    electronics: true,
    keywords: ['laptop', 'macbook', 'notebook pc', 'chromebook', 'desktop', 'monitor', 'imac', 'keyboard', 'mouse', 'printer', 'router', 'ssd', 'hard drive'],
  },
  { id: 'tv', label: 'TV', warrantyMonths: 12, electronics: true, keywords: ['tv', 'television', 'oled', 'qled', 'roku', 'soundbar', 'projector'] },
  {
    id: 'electronics',
    label: 'Electronics',
    warrantyMonths: 12,
    electronics: true,
    keywords: ['headphone', 'earbud', 'airpods', 'speaker', 'camera', 'console', 'playstation', 'xbox', 'nintendo', 'switch 2', 'charger', 'drone', 'gopro', 'echo', 'smart', 'electric toothbrush'],
  },
  {
    id: 'appliance',
    label: 'Appliance',
    warrantyMonths: 12,
    keywords: ['vacuum', 'dyson', 'roomba', 'washer', 'dryer', 'fridge', 'refrigerator', 'dishwasher', 'microwave', 'air purifier', 'humidifier', 'heater', 'fan', 'air fryer', 'air conditioner'],
  },
  {
    id: 'kitchen',
    label: 'Kitchen',
    warrantyMonths: 12,
    keywords: ['blender', 'kettle', 'toaster', 'coffee', 'espresso', 'mixer', 'instant pot', 'pressure cooker', 'cookware', 'pan', 'knife', 'skillet'],
  },
  { id: 'tools', label: 'Tools', warrantyMonths: 12, keywords: ['drill', 'saw', 'dewalt', 'milwaukee', 'ryobi', 'makita', 'mower', 'trimmer', 'wrench', 'toolset', 'tool'] },
  { id: 'furniture', label: 'Furniture', warrantyMonths: 12, keywords: ['sofa', 'couch', 'chair', 'desk', 'table', 'mattress', 'bed frame', 'dresser', 'bookcase', 'shelf'] },
  {
    id: 'shoes',
    label: 'Shoes',
    warrantyMonths: 0,
    keywords: ['boots', 'boot', 'sneaker', 'shoe', 'sandal', 'heels', 'loafer', 'slipper', 'cleats'],
  },
  {
    id: 'clothing',
    label: 'Clothing',
    warrantyMonths: 0,
    keywords: ['shirt', 'tee', 'jeans', 'pants', 'dress', 'jacket', 'coat', 'sweater', 'hoodie', 'shorts', 'skirt', 'sock', 'blouse', 'leggings', 'scarf', 'hat'],
  },
  { id: 'beauty', label: 'Beauty', warrantyMonths: 0, keywords: ['shampoo', 'lotion', 'serum', 'mascara', 'lipstick', 'perfume', 'cologne', 'moisturizer', 'cosmetic'] },
  { id: 'toys', label: 'Toys', warrantyMonths: 0, keywords: ['lego', 'toy', 'doll', 'puzzle', 'board game', 'plush'] },
  { id: 'sports', label: 'Sports & outdoors', warrantyMonths: 12, keywords: ['bike', 'bicycle', 'tent', 'treadmill', 'dumbbell', 'kayak', 'helmet', 'golf', 'yoga mat'] },
  { id: 'home', label: 'Home', warrantyMonths: 0, keywords: ['lamp', 'rug', 'curtain', 'towel', 'bedding', 'sheets', 'pillow', 'duvet', 'mirror', 'frame', 'candle'] },
  { id: 'grocery', label: 'Groceries', warrantyMonths: 0, keywords: ['milk', 'bread', 'eggs', 'banana', 'cheese', 'produce', 'chicken', 'cereal', 'yogurt'] },
  { id: 'other', label: 'Other', warrantyMonths: 0, keywords: [] },
];

export const categoryById = (id: CategoryId): Category => CATEGORIES.find((c) => c.id === id) ?? CATEGORIES[CATEGORIES.length - 1];

export interface HolidayRule {
  /** Purchases from..to (MM-DD, inclusive) can be returned until `until` (MM-DD, next year). */
  from: string;
  to: string;
  until: string;
}

export interface StorePolicy {
  name: string;
  /** Lowercase aliases matched against receipt text and typed store names. */
  aliases: string[];
  /** Standard window in days; null = no fixed limit. */
  returnDays: number | null;
  /** Shorter window for electronics, if the store has one. */
  electronicsDays?: number;
  /** Online-first store: the clock starts at delivery. */
  online?: boolean;
  holiday?: HolidayRule;
}

/** Typical windows, used as a starting point only. Check the receipt. */
export const STORES: StorePolicy[] = [
  { name: 'Target', aliases: ['target'], returnDays: 90, electronicsDays: 30, holiday: { from: '11-01', to: '12-24', until: '01-24' } },
  { name: 'Walmart', aliases: ['walmart', 'wal-mart', 'wal mart'], returnDays: 90, electronicsDays: 30, holiday: { from: '11-01', to: '12-25', until: '01-31' } },
  { name: 'Amazon', aliases: ['amazon', 'amazon.com'], returnDays: 30, online: true, holiday: { from: '11-01', to: '12-31', until: '01-31' } },
  { name: 'Best Buy', aliases: ['best buy', 'bestbuy'], returnDays: 15, electronicsDays: 15, holiday: { from: '11-01', to: '12-31', until: '01-14' } },
  { name: 'Costco', aliases: ['costco'], returnDays: null, electronicsDays: 90 },
  { name: 'The Home Depot', aliases: ['home depot', 'homedepot'], returnDays: 90 },
  { name: "Lowe's", aliases: ["lowe's", 'lowes'], returnDays: 90 },
  { name: 'Apple', aliases: ['apple store', 'apple.com', 'apple inc'], returnDays: 14, electronicsDays: 14 },
  { name: 'IKEA', aliases: ['ikea'], returnDays: 180 },
  { name: "Kohl's", aliases: ["kohl's", 'kohls'], returnDays: 180 },
  { name: "Macy's", aliases: ["macy's", 'macys'], returnDays: 30 },
  { name: 'Old Navy', aliases: ['old navy'], returnDays: 30 },
  { name: 'Gap', aliases: ['gap inc', 'gap store', 'gap.com'], returnDays: 30 },
  { name: 'Nike', aliases: ['nike'], returnDays: 60 },
  { name: 'Sephora', aliases: ['sephora'], returnDays: 30 },
  { name: 'Ulta', aliases: ['ulta'], returnDays: 60 },
  { name: 'TJ Maxx', aliases: ['tj maxx', 'tjmaxx', 't.j. maxx'], returnDays: 30 },
  { name: 'Marshalls', aliases: ['marshalls'], returnDays: 30 },
  { name: 'Nordstrom', aliases: ['nordstrom'], returnDays: null },
  { name: 'Walgreens', aliases: ['walgreens'], returnDays: 30 },
  { name: 'CVS', aliases: ['cvs'], returnDays: 60 },
];

/** Used when the store isn't in the list. */
export const DEFAULT_RETURN_DAYS = 30;

/** Days before a deadline to remind (each fires once). */
export const REMINDER_LEADS = {
  return: [7, 3, 1, 0],
  warranty: [30, 7],
  expires: [7, 3, 1, 0],
} as const;

/** Show recently passed return windows / expiries on Coming Up for this many days. */
export const SHOW_PAST_DAYS = 7;
