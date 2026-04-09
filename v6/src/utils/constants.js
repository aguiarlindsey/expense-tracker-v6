export const CURRENCIES = [
  {code:'INR',flag:'🇮🇳',symbol:'₹',   name:'Indian Rupee',              group:'Major'},
  {code:'USD',flag:'🇺🇸',symbol:'$',   name:'US Dollar',                 group:'Major'},
  {code:'EUR',flag:'🇪🇺',symbol:'€',   name:'Euro',                      group:'Major'},
  {code:'GBP',flag:'🇬🇧',symbol:'£',   name:'British Pound',             group:'Major'},
  {code:'JPY',flag:'🇯🇵',symbol:'¥',   name:'Japanese Yen',              group:'Major'},
  {code:'CHF',flag:'🇨🇭',symbol:'CHF', name:'Swiss Franc',               group:'Major'},
  {code:'CAD',flag:'🇨🇦',symbol:'C$',  name:'Canadian Dollar',           group:'Major'},
  {code:'AUD',flag:'🇦🇺',symbol:'A$',  name:'Australian Dollar',         group:'Major'},
  {code:'SGD',flag:'🇸🇬',symbol:'S$',  name:'Singapore Dollar',          group:'Asia-Pacific'},
  {code:'AED',flag:'🇦🇪',symbol:'د.إ', name:'UAE Dirham',                group:'Middle East'},
  {code:'MYR',flag:'🇲🇾',symbol:'RM',  name:'Malaysian Ringgit',         group:'Asia-Pacific'},
  {code:'THB',flag:'🇹🇭',symbol:'฿',   name:'Thai Baht',                 group:'Asia-Pacific'},
  {code:'CNY',flag:'🇨🇳',symbol:'¥',   name:'Chinese Yuan',              group:'Asia-Pacific'},
  {code:'HKD',flag:'🇭🇰',symbol:'HK$', name:'Hong Kong Dollar',          group:'Asia-Pacific'},
  {code:'KRW',flag:'🇰🇷',symbol:'₩',   name:'South Korean Won',          group:'Asia-Pacific'},
  {code:'BRL',flag:'🇧🇷',symbol:'R$',  name:'Brazilian Real',            group:'Americas'},
  {code:'MXN',flag:'🇲🇽',symbol:'$',   name:'Mexican Peso',              group:'Americas'},
  {code:'ZAR',flag:'🇿🇦',symbol:'R',   name:'South African Rand',        group:'Africa'},
  {code:'SAR',flag:'🇸🇦',symbol:'﷼',   name:'Saudi Riyal',               group:'Middle East'},
  {code:'QAR',flag:'🇶🇦',symbol:'﷼',   name:'Qatari Riyal',              group:'Middle East'},
  {code:'TRY',flag:'🇹🇷',symbol:'₺',   name:'Turkish Lira',              group:'Middle East'},
  {code:'SEK',flag:'🇸🇪',symbol:'kr',  name:'Swedish Krona',             group:'Europe'},
  {code:'NOK',flag:'🇳🇴',symbol:'kr',  name:'Norwegian Krone',           group:'Europe'},
  {code:'DKK',flag:'🇩🇰',symbol:'kr',  name:'Danish Krone',              group:'Europe'},
  {code:'PLN',flag:'🇵🇱',symbol:'zł',  name:'Polish Zloty',              group:'Europe'},
  {code:'RUB',flag:'🇷🇺',symbol:'₽',   name:'Russian Ruble',             group:'Europe'},
  {code:'BTC',flag:'₿',  symbol:'₿',   name:'Bitcoin',                   group:'Alternative Assets'},
  {code:'ETH',flag:'Ξ',  symbol:'Ξ',   name:'Ethereum',                  group:'Alternative Assets'},
]

export const CM = Object.fromEntries(CURRENCIES.map(c => [c.code, c]))

export const CATS = {
  'Food':          { icon: '🍽️', color: '#f97316', subs: ['Groceries','Restaurants','Snacks','Beverages','Sweets','Takeaway'] },
  'Transport':     { icon: '🚗', color: '#3b82f6', subs: ['Fuel','Auto/Cab','Bus/Train','Flight','Parking','Vehicle Maintenance'] },
  'Shopping':      { icon: '🛍️', color: '#8b5cf6', subs: ['Clothes','Electronics','Furniture','Books','Accessories','Appliances'] },
  'Health':        { icon: '💊', color: '#ef4444', subs: ['Medicine','Doctor','Lab Tests','Hospital','Wellness','Dental'] },
  'Entertainment': { icon: '🎬', color: '#ec4899', subs: ['Movies','OTT/Streaming','Gaming','Events','Hobbies','Sports'] },
  'Utilities':     { icon: '💡', color: '#f59e0b', subs: ['Electricity','Water','Gas','Internet','Phone','Cable'] },
  'Housing':       { icon: '🏠', color: '#10b981', subs: ['Rent','EMI','Maintenance','Repairs','Security','Interior'] },
  'Education':     { icon: '📚', color: '#06b6d4', subs: ['Fees','Books','Courses','Stationery','Coaching','Exams'] },
  'Personal':      { icon: '💆', color: '#84cc16', subs: ['Haircut','Skincare','Gym','Spa','Personal Care','Fashion'] },
  'Travel':        { icon: '✈️', color: '#6366f1', subs: ['Hotel','Sightseeing','Visa','Insurance','Souvenirs','Transport'] },
  'Finance':       { icon: '💰', color: '#14b8a6', subs: ['Insurance','Tax','Loan Payment','Investment','Bank Fees','Savings'] },
  'Social':        { icon: '🎉', color: '#f43f5e', subs: ['Gifts','Parties','Donations','Subscriptions','Events','Dining Out'] },
  'Administrative':{ icon: '🗂️', color: '#0ea5e9', subs: ['License Renewal','Passport Renewal','Government Fees','Notary/Legal','Other Govt Fees'] },
  'Other':         { icon: '📌', color: '#94a3b8', subs: ['Miscellaneous','Uncategorized','Refund','Transfer'] },
}

export const VALID_CATS     = Object.keys(CATS)

// 259-colour custom palette (ported from v5)
export const CC = [
  '#ed2a2a','#ed4b2a','#ed6b2a','#ed8c2a','#edac2a','#edcd2a','#eded2a','#cded2a',
  '#aced2a','#8ced2a','#6bed2a','#4bed2a','#2aed2a','#2aed4b','#2aed6b','#2aed8c',
  '#2aedac','#2aedcd','#2aeded','#2acded','#2aaced','#2a8ced','#2a6bed','#2a4bed',
  '#2a2aed','#4b2aed','#6b2aed','#8c2aed','#ac2aed','#cd2aed','#ed2aed','#ed2acd',
  '#ed2aac','#ed2a8c','#ed2a6b','#ed2a4b','#e67474','#e68774','#e69a74','#e6ad74',
  '#e6c074','#e6d374','#e6e674','#d3e674','#c0e674','#ade674','#9ae674','#87e674',
  '#74e674','#74e687','#74e69a','#74e6ad','#74e6c0','#74e6d3','#74e6e6','#74d3e6',
  '#74c0e6','#74ade6','#749ae6','#7487e6','#7474e6','#8774e6','#9a74e6','#ad74e6',
  '#c074e6','#d374e6','#e674e6','#e674d3','#e674c0','#e674ad','#e6749a','#e67487',
  '#b80909','#b82609','#b84309','#b86009','#b87d09','#b89b09','#b8b809','#9bb809',
  '#7db809','#60b809','#43b809','#26b809','#09b809','#09b826','#09b843','#09b860',
  '#09b87d','#09b89b','#09b8b8','#099bb8','#097db8','#0960b8','#0943b8','#0926b8',
  '#0909b8','#2609b8','#4309b8','#6009b8','#7d09b8','#9b09b8','#b809b8','#b8099b',
  '#b8097d','#b80960','#b80943','#b80926','#bf3f3f','#bf553f','#bf6a3f','#bf7f3f',
  '#bf943f','#bfaa3f','#bfbf3f','#a9bf3f','#94bf3f','#7fbf3f','#6abf3f','#55bf3f',
  '#3fbf3f','#3fbf55','#3fbf6a','#3fbf7f','#3fbf94','#3fbfaa','#3fbfbf','#3fa9bf',
  '#3f94bf','#3f7fbf','#3f6abf','#3f55bf','#3f3fbf','#543fbf','#6a3fbf','#7f3fbf',
  '#943fbf','#a93fbf','#bf3fbf','#bf3fa9','#bf3f94','#bf3f7f','#bf3f6a','#bf3f55',
  '#ef0000','#ef2700','#ef4f00','#ef7700','#ef9f00','#efc700','#efef00','#c7ef00',
  '#9fef00','#77ef00','#4fef00','#27ef00','#00ef00','#00ef27','#00ef4f','#00ef77',
  '#00ef9f','#00efc7','#00efef','#00c7ef','#009fef','#0077ef','#004fef','#0027ef',
  '#0000ef','#2700ef','#4f00ef','#7700ef','#9f00ef','#c700ef','#ef00ef','#ef00c7',
  '#ef009f','#ef0077','#ef004f','#ef0027','#e59898','#e5a598','#e5b298','#e5bf98',
  '#e5cc98','#e5d898','#e5e598','#d8e598','#cbe598','#bfe598','#b2e598','#a5e598',
  '#98e598','#98e5a5','#98e5b2','#98e5bf','#98e5cc','#98e5d8','#98e5e5','#98d8e5',
  '#98cbe5','#98bfe5','#98b2e5','#98a5e5','#9898e5','#a598e5','#b298e5','#bf98e5',
  '#cc98e5','#d898e5','#e598e5','#e598d8','#e598cb','#e598bf','#e598b2','#e598a5',
  '#ffffff','#f8fafc','#f1f5f9','#e2e8f0','#d1d5db','#9ca3af','#6b7280','#4b5563',
  '#374151','#1f2937','#111827','#000000','#fef9c3','#fef08a','#fde047','#facc15',
  '#eab308','#ca8a04','#a16207','#854d0e','#dcfce7','#bbf7d0','#86efac','#4ade80',
  '#22c55e','#16a34a','#15803d','#166534','#dbeafe','#bfdbfe','#93c5fd','#60a5fa',
  '#3b82f6','#1d4ed8','#1e40af','#fce7f3','#fbcfe8','#f9a8d4','#f472b6','#ec4899',
  '#db2777','#be185d','#9d174d',
]
// Ground-truth rates as of April 2026 (INR base — 1 INR = X units)
export const FALLBACK_RATES = {
  USD: 0.01195,
  EUR: 0.01104,
  GBP: 0.00942,
  AED: 0.04388,
  SGD: 0.01609,
  CAD: 0.01659,
  AUD: 0.01856,
  JPY: 1.7850,
  CNY: 0.08670,
  CHF: 0.01074,
  MYR: 0.05283,
  THB: 0.41200,
  HKD: 0.09310,
  KRW: 16.430,
  BRL: 0.06830,
  MXN: 0.23700,
  ZAR: 0.21780,
  SAR: 0.04481,
  QAR: 0.04350,
  TRY: 0.41000,
  SEK: 0.12360,
  NOK: 0.12870,
  DKK: 0.07780,
  PLN: 0.04840,
  RUB: 1.09500,
  INR: 1,
}

export const PAY_METHODS    = ['Cash','Credit Card','Debit Card','UPI/QR','Net Banking','Wallet','Cheque','EMI','Other']
export const UPI_APPS       = ['','GPay','PhonePe','Paytm','PayZapp','BHIM','Amazon Pay','WhatsApp Pay','Cred','Slice','Other']
export const WALLET_APPS    = ['','Amazon Pay','Paytm','PhonePe','Mobikwik','Freecharge','Ola Money','Jio Money','Other']
export const INC_SOURCES    = ['Salary','Freelance','Business','Rental','Dividends','Interest','Bonus','Gift','Refund','Side Income','Other']
export const DINING_APPS    = ['','Swiggy','Zomato','Keta','Dineout','EatSure','Blinkit','Zepto','Direct/Self']
export const GROCERY_TAGS   = ['Food','Beverages','Snacks','Dairy','Produce','Meat/Fish','Grains','Condiments','Frozen','Personal Care','Household','Baby/Kids','Pet Food','Bakery','Health/Organic','Other']
export const EXP_TYPES      = ['variable','fixed','luxury','need','want','investment']
export const RECURRING_PERIODS = [
  { val: 'daily',     label: 'Daily' },
  { val: 'weekly',    label: 'Weekly' },
  { val: 'biweekly',  label: 'Bi-weekly' },
  { val: 'monthly',   label: 'Monthly' },
  { val: 'quarterly', label: 'Quarterly' },
  { val: 'yearly',    label: 'Yearly' },
]
