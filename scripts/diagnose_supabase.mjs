import { createClient } from '@supabase/supabase-js';

const url = process.env.VITE_SUPABASE_URL;
const key = process.env.VITE_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

console.log('--- SUPABASE PROJECT INFO ---');
console.log('Host URL:', url);
console.log('Project ID:', url ? url.replace('https://', '').replace('.supabase.co', '') : 'N/A');

const supabase = createClient(url, key);

async function run() {
  console.log('\n--- 1. CONSULTANDO GRUPOS ---');
  const { data: grupos, error: gErr } = await supabase.from('grupos').select('*');
  if (gErr) console.error('Erro ao buscar grupos:', gErr);
  else console.log('Grupos encontrados:', JSON.stringify(grupos, null, 2));

  const cajuba = grupos?.find(g => g.nome.toUpperCase().includes('CAJUBA') || g.nome.toUpperCase().includes('CLUB')) || grupos?.[0];
  console.log('\nGrupo Selecionado:', cajuba);

  if (cajuba) {
    console.log('\n--- 2. CONSULTANDO QUADRAS DO GRUPO ---');
    const { data: quadras, error: qErr } = await supabase.from('quadras').select('*').eq('grupo_id', cajuba.id);
    if (qErr) console.error('Erro quadras:', qErr);
    else console.log('Quadras:', JSON.stringify(quadras, null, 2));

    console.log('\n--- 3. CONSULTANDO HORÁRIOS DO GRUPO ---');
    const { data: horarios, error: hErr } = await supabase.from('horarios').select('*').eq('grupo_id', cajuba.id);
    if (hErr) console.error('Erro horarios:', hErr);
    else console.log('Horários:', JSON.stringify(horarios, null, 2));

    console.log('\n--- 4. CONSULTANDO MEMBROS DO GRUPO ---');
    const { data: membros, error: mErr } = await supabase.from('membros_grupo').select('*, usuario:usuarios(*)').eq('grupo_id', cajuba.id);
    if (mErr) console.error('Erro membros:', mErr);
    else console.log('Membros:', JSON.stringify(membros, null, 2));

    console.log('\n--- 5. CONSULTANDO RESERVAS DO GRUPO EM 2026-08-26 ---');
    const { data: reservas, error: rErr } = await supabase.from('reservas').select('*').eq('grupo_id', cajuba.id).eq('data', '2026-08-26');
    if (rErr) console.error('Erro reservas:', rErr);
    else console.log('Reservas em 2026-08-26:', JSON.stringify(reservas, null, 2));

    console.log('\n--- 6. CONSULTANDO CONFIGURAÇÕES DO GRUPO ---');
    const { data: configs, error: cErr } = await supabase.from('configuracoes_grupo').select('*').eq('grupo_id', cajuba.id);
    if (cErr) console.error('Erro configuracoes_grupo:', cErr);
    else console.log('Configurações:', JSON.stringify(configs, null, 2));
  }

  console.log('\n--- 7. CONSULTANDO USUÁRIOS (ex: Maurício) ---');
  const { data: usuarios, error: uErr } = await supabase.from('usuarios').select('*');
  if (uErr) console.error('Erro usuarios:', uErr);
  else console.log('Usuários:', JSON.stringify(usuarios, null, 2));
}

run().catch(console.error);
