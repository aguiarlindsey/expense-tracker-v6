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
export const PAY_METHODS    = ['Cash','Credit Card','Debit Card','UPI/QR','Net Banking','Wallet','Cheque','EMI','Other']
export const INC_SOURCES    = ['Salary','Freelance','Business','Rental','Dividends','Interest','Bonus','Gift','Refund','Side Income','Other']
export const EXP_TYPES      = ['variable','fixed','luxury','need','want','investment']
export const RECURRING_PERIODS = [
  { val: 'daily',     label: 'Daily' },
  { val: 'weekly',    label: 'Weekly' },
  { val: 'biweekly',  label: 'Bi-weekly' },
  { val: 'monthly',   label: 'Monthly' },
  { val: 'quarterly', label: 'Quarterly' },
  { val: 'yearly',    label: 'Yearly' },
]
