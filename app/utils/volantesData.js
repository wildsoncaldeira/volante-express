// app/utils/volantesData.js
// Dados e helpers da tela de Treinamento de Fotos (classificação de volantes).
// Portado de "treinamento-volantes.html" — SEM nenhuma chave embutida.

export const FREQ_MARCA = {
  'FIAT':100,'CHEVROLET':95,'VOLKSWAGEM':80,'HYUNDAI':60,'TOYOTA':55,
  'HONDA':50,'FORD':45,'RENAULT':30,'CITROEN':20,'PEUGEOT':15,'NISSAN':15,
  'JEEP':12,'MITSHUBISHI':10,'KIA':8,'CAMINHAO- VAN':8,'MERCEDES':6,
  'AUDI':4,'BMW':3,'SUZUKI':3,'LAND ROVER':2,'CAOA CHERRY':2,'BYD':2,
  'JAC':1,'LIFAN':1,'SSANGIONG':1,'00-COSTURA':0,'ANTES E DEPOIS':0,
};

export const FREQ_SLUG = {
  'onix':50,'palio':45,'hb20':40,'s10':35,'cobalt':30,'civic':30,'corolla':30,
  'strada':28,'fiesta':25,'ka':25,'vectra':25,'siena':25,'gol g6':22,'gol g5':20,
  'mobi':20,'fox':18,'kwid':18,'duster':18,'hilux':18,'etios':16,'celta':15,
  'prisma':15,'classic':12,'uno':12,'stilo':10,'punto':10,'c3':10,'kicks':8,
  'ecosport':8,'ranger':8,'gol bola':8,'gol antigo':6,'voyage':8,'saveiro':7,
  'lancer':6,'asx':6,'clio':5,'logan':5,'sandero':5,'montana':8,'agile':8,
  'corsa':8,'astra':7,
};

export const MODELOS = [
  {m:'Onix',ma:'CHEVROLET',f:50},{m:'Onix 2020+',ma:'CHEVROLET',f:48},
  {m:'Palio',ma:'FIAT',f:45},{m:'Palio Attractive',ma:'FIAT',f:40},
  {m:'Palio Sporting',ma:'FIAT',f:38},{m:'HB20',ma:'HYUNDAI',f:40},
  {m:'HB20 2019-2020',ma:'HYUNDAI',f:38},{m:'HB20 2021+',ma:'HYUNDAI',f:36},
  {m:'S10 2012+',ma:'CHEVROLET',f:35},{m:'S10 2011-',ma:'CHEVROLET',f:33},
  {m:'Cobalt',ma:'CHEVROLET',f:30},{m:'Civic 2007+',ma:'HONDA',f:30},
  {m:'Civic 2006-',ma:'HONDA',f:28},{m:'Corolla 2009-2013',ma:'TOYOTA',f:30},
  {m:'Corolla 2008-',ma:'TOYOTA',f:28},{m:'Corolla 2014+',ma:'TOYOTA',f:26},
  {m:'Corolla Novo',ma:'TOYOTA',f:24},{m:'Strada',ma:'FIAT',f:28},
  {m:'Strada 2020+',ma:'FIAT',f:26},{m:'New Fiesta',ma:'FORD',f:25},
  {m:'Ford Ka 2014+',ma:'FORD',f:25},{m:'Ford Ka 2013',ma:'FORD',f:23},
  {m:'Ford Ka 2008-',ma:'FORD',f:21},{m:'Vectra',ma:'CHEVROLET',f:25},
  {m:'Siena',ma:'FIAT',f:25},{m:'Grand Siena',ma:'FIAT',f:23},
  {m:'Gol G6',ma:'VOLKSWAGEM',f:22},{m:'Gol G5',ma:'VOLKSWAGEM',f:20},
  {m:'Mobi',ma:'FIAT',f:20},{m:'Fox',ma:'VOLKSWAGEM',f:18},
  {m:'Kwid',ma:'RENAULT',f:18},{m:'Duster',ma:'RENAULT',f:18},
  {m:'Hilux 2016+',ma:'TOYOTA',f:18},{m:'Hilux 2012-2015',ma:'TOYOTA',f:16},
  {m:'Hilux 2011-',ma:'TOYOTA',f:14},{m:'Etios 2015+',ma:'TOYOTA',f:16},
  {m:'Etios 2013-',ma:'TOYOTA',f:14},{m:'Celta',ma:'CHEVROLET',f:15},
  {m:'Prisma',ma:'CHEVROLET',f:15},{m:'Classic',ma:'CHEVROLET',f:12},
  {m:'Uno',ma:'FIAT',f:12},{m:'Uno Mille',ma:'FIAT',f:10},
  {m:'Stilo',ma:'FIAT',f:10},{m:'Punto',ma:'FIAT',f:10},
  {m:'C3',ma:'CITROEN',f:10},{m:'C3 2022+',ma:'CITROEN',f:8},
  {m:'Kicks',ma:'NISSAN',f:8},{m:'EcoSport',ma:'FORD',f:8},
  {m:'EcoSport 2003+',ma:'FORD',f:7},{m:'Ranger',ma:'FORD',f:8},
  {m:'Gol Bola',ma:'VOLKSWAGEM',f:8},{m:'Gol Antigo',ma:'VOLKSWAGEM',f:6},
  {m:'Voyage',ma:'VOLKSWAGEM',f:8},{m:'Saveiro',ma:'VOLKSWAGEM',f:7},
  {m:'Lancer',ma:'MITSHUBISHI',f:6},{m:'ASX',ma:'MITSHUBISHI',f:5},
  {m:'L200 Triton',ma:'MITSHUBISHI',f:5},{m:'Clio',ma:'RENAULT',f:5},
  {m:'Logan',ma:'RENAULT',f:5},{m:'Sandero',ma:'RENAULT',f:5},
  {m:'Oroch',ma:'RENAULT',f:4},{m:'Fluence',ma:'RENAULT',f:3},
  {m:'Montana',ma:'CHEVROLET',f:8},{m:'Agile',ma:'CHEVROLET',f:8},
  {m:'Corsa',ma:'CHEVROLET',f:8},{m:'Meriva',ma:'CHEVROLET',f:6},
  {m:'Astra',ma:'CHEVROLET',f:7},{m:'Cruze',ma:'CHEVROLET',f:6},
  {m:'Tracker',ma:'CHEVROLET',f:5},{m:'Honda City',ma:'HONDA',f:6},
  {m:'Honda Fit',ma:'HONDA',f:5},{m:'HR-V',ma:'HONDA',f:4},
  {m:'Linea',ma:'FIAT',f:4},{m:'Bravo',ma:'FIAT',f:3},
  {m:'Argo',ma:'FIAT',f:4},{m:'Cronos',ma:'FIAT',f:3},
  {m:'Toro',ma:'FIAT',f:4},{m:'Freemont',ma:'FIAT',f:3},
  {m:'Tipo',ma:'FIAT',f:2},{m:'Brava',ma:'FIAT',f:2},{m:'Marea',ma:'FIAT',f:2},
  {m:'Gol Quadrado',ma:'VOLKSWAGEM',f:4},{m:'Gol G4',ma:'VOLKSWAGEM',f:4},
  {m:'Golf',ma:'VOLKSWAGEM',f:4},{m:'Polo',ma:'VOLKSWAGEM',f:4},
  {m:'Virtus',ma:'VOLKSWAGEM',f:3},{m:'T-Cross',ma:'VOLKSWAGEM',f:3},
  {m:'Jetta',ma:'VOLKSWAGEM',f:3},{m:'Amarok',ma:'VOLKSWAGEM',f:2},
  {m:'Parati',ma:'VOLKSWAGEM',f:3},{m:'Santana',ma:'VOLKSWAGEM',f:2},
  {m:'Creta',ma:'HYUNDAI',f:6},{m:'Tucson',ma:'HYUNDAI',f:5},{m:'i30',ma:'HYUNDAI',f:4},
  {m:'Peugeot 208',ma:'PEUGEOT',f:6},{m:'Peugeot 307',ma:'PEUGEOT',f:4},
  {m:'Frontier',ma:'NISSAN',f:5},{m:'March',ma:'NISSAN',f:4},
  {m:'Versa',ma:'NISSAN',f:4},{m:'Sentra',ma:'NISSAN',f:3},{m:'Tiida',ma:'NISSAN',f:2},
  {m:'Compass',ma:'JEEP',f:5},{m:'Renegade',ma:'JEEP',f:4},{m:'Commander',ma:'JEEP',f:3},
  {m:'Sportage',ma:'KIA',f:4},{m:'Sorento',ma:'KIA',f:3},{m:'Cerato',ma:'KIA',f:3},
  {m:'Focus',ma:'FORD',f:4},{m:'Fusion',ma:'FORD',f:3},{m:'Edge',ma:'FORD',f:2},
  {m:'Sprinter',ma:'CAMINHAO- VAN',f:4},{m:'Iveco Daily',ma:'CAMINHAO- VAN',f:3},
  {m:'Scania',ma:'CAMINHAO- VAN',f:3},{m:'Volvo FH',ma:'CAMINHAO- VAN',f:2},
  {m:'Omega',ma:'CHEVROLET',f:3},{m:'Opala',ma:'CHEVROLET',f:2},
  {m:'Camry',ma:'TOYOTA',f:2},{m:'Yaris',ma:'TOYOTA',f:3},
  {m:'C4',ma:'CITROEN',f:3},{m:'Megane',ma:'RENAULT',f:2},{m:'Scenic',ma:'RENAULT',f:2},
].sort((a, b) => b.f - a.f);

// Prioridade = frequência da marca + 2x a frequência do slug mais "forte".
export function calcularPrioridade(foto) {
  const fm = FREQ_MARCA[foto.marca] || 0;
  let fs = 0;
  const slug = (foto.modelo_slug || '').toLowerCase();
  for (const [s, f] of Object.entries(FREQ_SLUG)) if (slug.includes(s)) fs = Math.max(fs, f);
  return fm + fs * 2;
}

export function badgePrioridade(prio) {
  if (prio >= 80) return { texto: '🔥 ALTA', classe: 'bg-emerald-500 text-black' };
  if (prio >= 30) return { texto: '⚡ MÉDIA', classe: 'bg-amber-500 text-black' };
  return { texto: 'BAIXA', classe: 'bg-slate-700 text-slate-300' };
}
