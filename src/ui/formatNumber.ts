const compact=new Intl.NumberFormat('en-US',{notation:'compact',maximumFractionDigits:1});
export const formatNumber=(value:number):string=>compact.format(value);
