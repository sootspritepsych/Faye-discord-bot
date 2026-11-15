/**
 * Shared garden holidays are selected by UTC calendar date. The key includes
 * a year, so decorations naturally reset when a holiday window ends while
 * preserving historical contributions and ornaments for audit.
 */
export type GardenDecoration = "star" | "red_bauble" | "gold_bauble" | "snowflake" |
  "ribbon" | "lights" | "heart" | "shamrock" | "egg" | "flower" | "rainbow" |
  "flag" | "firework" | "leaf" | "pumpkin" | "ghost" | "turkey" | "mushroom" | "lantern" | "butterfly" | "pinecone" | "candy_cane" | "bell" | "snowman" | "bat";

export type GardenHoliday = {
  id: string; name: string; emoji: string; cycle: number;
  allowed: GardenDecoration[];
};

const decorations: Record<string, GardenDecoration[]> = {
  newyear: ["star","gold_bauble","firework","lights","lantern","bell"],
  valentines: ["heart","ribbon","flower","lights","butterfly"],
  stpatricks: ["shamrock","leaf","lights","mushroom"],
  easter: ["egg","flower","ribbon","butterfly"],
  earthday: ["leaf","flower","rainbow","butterfly","mushroom"],
  memorial: ["flag","star","flower"],
  pride: ["rainbow","flower","lights","butterfly","lantern"],
  independence: ["flag","firework","star","lights"],
  laborday: ["star","flower","flag"],
  halloween: ["pumpkin","ghost","leaf","lights","bat","mushroom","lantern"],
  thanksgiving: ["turkey","leaf","pumpkin","ribbon","pinecone","mushroom"],
  christmas: ["star","red_bauble","gold_bauble","snowflake","ribbon","lights","candy_cane","bell","snowman","pinecone","lantern"],
  winter: ["snowflake","star","lights","snowman","pinecone","lantern"],
  spring: ["flower","leaf","egg","butterfly","mushroom"],
  summer: ["flower","rainbow","lights","butterfly","lantern"],
  autumn: ["leaf","pumpkin","ribbon","pinecone","mushroom","lantern"],
};

function easterUTC(year: number): Date {
  const a=year%19,b=Math.floor(year/100),c=year%100,
    d=Math.floor(b/4),e=b%4,f=Math.floor((b+8)/25),
    g=Math.floor((b-f+1)/3),h=(19*a+b-d-g+15)%30,
    i=Math.floor(c/4),k=c%4,l=(32+2*e+2*i-h-k+700)%7,
    m=Math.floor((a+11*h+22*l)/451),z=h+l-7*m+114;
  return new Date(Date.UTC(year,Math.floor(z/31)-1,(z%31)+1));
}

function aroundHoliday(when: Date, event: Date, before: number, after: number): boolean {
  const day=Date.UTC(when.getUTCFullYear(),when.getUTCMonth(),when.getUTCDate());
  const delta=(day-event.getTime())/86400000;
  return delta>=-before && delta<=after;
}
function nthWeekday(year:number,month:number,weekday:number,n:number): Date {
  const first=new Date(Date.UTC(year,month,1));
  const day=1+(weekday-first.getUTCDay()+7)%7+7*(n-1);
  return new Date(Date.UTC(year,month,day));
}
function lastWeekday(year:number,month:number,weekday:number): Date {
  const end=new Date(Date.UTC(year,month+1,0));
  return new Date(Date.UTC(year,month,end.getUTCDate()-(end.getUTCDay()-weekday+7)%7));
}

export function currentGardenHoliday(now = new Date()): GardenHoliday {
  const year=now.getUTCFullYear(),month=now.getUTCMonth()+1,day=now.getUTCDate();
  let id="winter",name="Winter Garden",emoji="❄️",cycle=year;
  if (month===1 && day<=7 || month===12 && day>=27) {
    id="newyear";name="New Year's Garden";emoji="🎆";
    cycle=month===12?year+1:year;
  } else if (month===2 && day<=14) {
    id="valentines";name="Valentine's Garden";emoji="💗";
  } else if (month===3 && day<=17) {
    id="stpatricks";name="St. Patrick's Garden";emoji="☘️";
  } else if (aroundHoliday(now,easterUTC(year),12,2)) {
    id="easter";name="Spring & Easter Garden";emoji="🐣";
  } else if (month===4 && day>=18 && day<=25) {
    id="earthday";name="Earth Day Garden";emoji="🌎";
  } else if (aroundHoliday(now,lastWeekday(year,4,1),3,1)) {
    id="memorial";name="Memorial Day Garden";emoji="🇺🇸";
  } else if (month===6) {
    id="pride";name="Pride Garden";emoji="🌈";
  } else if (month===7 && day<=7) {
    id="independence";name="Independence Day Garden";emoji="🎆";
  } else if (aroundHoliday(now,nthWeekday(year,8,1,1),3,1)) {
    id="laborday";name="Labor Day Garden";emoji="🌻";
  } else if (month===10) {
    id="halloween";name="Halloween Garden";emoji="🎃";
  } else if (month===11) {
    id="thanksgiving";name="Autumn & Thanksgiving Garden";emoji="🍂";
  } else if (month===12 && day<=26) {
    id="christmas";name="Winter Holiday Garden";emoji="🎄";
  } else if (month>=3 && month<=5) {
    id="spring";name="Spring Garden";emoji="🌷";
  } else if (month>=6 && month<=8) {
    id="summer";name="Summer Garden";emoji="🌞";
  } else if (month>=9 && month<=11) {
    id="autumn";name="Autumn Garden";emoji="🍁";
  }
  return {id,name,emoji,cycle,allowed:decorations[id] ?? decorations.winter};
}

export const decorationEmoji: Record<GardenDecoration,string> = {
  star:"⭐",red_bauble:"🔴",gold_bauble:"🟡",snowflake:"❄️",
  ribbon:"🎀",lights:"✨",heart:"💗",shamrock:"☘️",egg:"🥚",
  flower:"🌸",rainbow:"🌈",flag:"🇺🇸",firework:"🎆",leaf:"🍁",
  pumpkin:"🎃",ghost:"👻",turkey:"🦃",mushroom:"🍄",lantern:"🏮",butterfly:"🦋",pinecone:"🌰",
  candy_cane:"🍬",bell:"🔔",snowman:"⛄",bat:"🦇",
};
