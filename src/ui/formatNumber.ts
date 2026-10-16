const compact=new Intl.NumberFormat('en-US',{notation:'compact',maximumFractionDigits:1});
export const formatNumber=(value:number):string=>compact.format(value);
const income=new Intl.NumberFormat('en-US',{notation:'compact',maximumFractionDigits:2});
export const formatIncome=(value:number):string=>income.format(value);
