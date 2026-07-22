// Dicionário de Aliases Inteligentes (Ad Set Name -> Supabase Calendar Name / City)
const ALIAS_MAP = {
    'samonte': 'Santo Antônio do Monte',
    'santo antonio do monte': 'Santo Antônio do Monte',
    'paraopeba': 'Paraopeba / Caetanópolis',
    'sete lagoas': 'Sete Lagoas',
    'curvelo': 'Curvelo',
    'pedro leopoldo': 'Pedro Leopoldo',
    'matosinhos': 'Matozinhos',
    'matozinhos': 'Matozinhos',
    'lagoa santa': 'Lagoa Santa',
    'vespasiano': 'Vespasiano',
    'divinopolis': 'Divinópolis',
    'divinópolis': 'Divinópolis',
    'itauna': 'Itaúna',
    'itaúna': 'Itaúna',
    'para de minas': 'Pará de Minas',
    'pará de minas': 'Pará de Minas',
    'nova serrana': 'Nova Serrana',
    'bom despacho': 'Bom Despacho',
    'formiga': 'Formiga',
    'claudio': 'Cláudio',
    'cláudio': 'Cláudio',
    'lagoa da prata': 'Lagoa da Prata',
    'pitangui': 'Pitangui',
    'carmo do cajuru': 'Carmo do Cajuru',
    'oliveira': 'Oliveira',
    'itapecerica': 'Itapecerica'
};

export function identifyCityFromAdSet(adSetName) {
    if (!adSetName) return 'Desconhecida';
    const nameLower = adSetName.toLowerCase();
    for (const [alias, dbName] of Object.entries(ALIAS_MAP)) {
        if (nameLower.includes(alias)) {
            return dbName;
        }
    }
    return 'Desconhecida';
}
