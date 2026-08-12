import jsPDF from 'jspdf';

export interface ManualSection {
  title: string;
  category: string;
  icon: string;
  badgeColor: string;
  description: string;
  steps: {
    number: number;
    title: string;
    detail: string;
    tip?: string;
  }[];
}

export const MANUAL_DATA: ManualSection[] = [
  {
    title: '1. Como Cadastrar e Acessar o App',
    category: 'Geral',
    icon: '🚀',
    badgeColor: '#f97316', // orange
    description: 'Aprenda a fazer seu primeiro acesso na plataforma TennisPlay em qualquer dispositivo (Celular ou Computador).',
    steps: [
      {
        number: 1,
        title: 'Acessar a Plataforma',
        detail: 'Abra seu navegador (Chrome, Safari ou Edge) e acesse o link oficial da sua comunidade TennisPlay.',
        tip: 'Você pode salvar o site na tela inicial do seu celular para usar como um aplicativo (PWA).'
      },
      {
        number: 2,
        title: 'Escolher a Opção no Menu Inicial',
        detail: 'Na página de abertura, escolha a opção adequada: "Criar Meu Grupo", "Sou Administrador", "Sou Jogador" ou "Entrar na Conta".',
      },
      {
        number: 3,
        title: 'Preencher Dados do Cadastro',
        detail: 'Informe seu Nome Completo, WhatsApp (com DDD), E-mail e crie uma senha segura.',
        tip: 'O número do WhatsApp é importante para avisos e confirmações de parceiros de jogo.'
      },
      {
        number: 4,
        title: 'Confirmar e Acessar o Painel',
        detail: 'Após concluir o cadastro, seu acesso será liberado no grupo associado. Em grupos privados, o administrador precisará aprovar sua entrada.'
      }
    ]
  },
  {
    title: '2. Criar um Novo Grupo de Tênis (Para Proprietários / Gestores)',
    category: 'Criar Grupo',
    icon: '🏢',
    badgeColor: '#ea580c', // orange dark
    description: 'Guia para donos de quadras, condomínios, academias e organizadores de grupos independentes.',
    steps: [
      {
        number: 1,
        title: 'Acessar "Criar Meu Grupo"',
        detail: 'Na tela inicial, clique no botão "Criar Meu Grupo". Preencha seus dados de proprietário se ainda não tiver conta.',
      },
      {
        number: 2,
        title: 'Definir Informações da Comunidade',
        detail: 'Digite o Nome do Grupo (ex: "Clube da Bolinha - Saibro"), Cidade e Estado.',
      },
      {
        number: 3,
        title: 'Gerar o Código do Grupo (Código de Acesso)',
        detail: 'Crie um código exclusivo (ex: "TENIS2026"). Este código será usado pelos jogadores para solicitarem entrada no seu grupo.',
        tip: 'Mantenha o código fácil de memorizar para compartilhar no grupo do WhatsApp.'
      },
      {
        number: 4,
        title: 'Cadastrar Quadras e Configurações',
        detail: 'No Painel Administrativo, adicione as quadras (ex: "Quadra 1 - Saibro Coberta"), defina a duração das partidas e horários permitidos.',
      }
    ]
  },
  {
    title: '3. Manual do Administrador (Gestão & Controle)',
    category: 'Administrador',
    icon: '🛡️',
    badgeColor: '#2563eb', // blue
    description: 'Instruções para administradores aprovarem jogadores, gerenciarem reservas e manterem as regras do clube.',
    steps: [
      {
        number: 1,
        title: 'Aprovar Solicitantes de Entrada',
        detail: 'Acesse a aba "Membros". Os novos jogadores que digitarem o código do grupo ficarão com status "Pendente". Clique em "Aprovar".',
        tip: 'Você também pode recusar ou remover membros que não fazem mais parte do clube.'
      },
      {
        number: 2,
        title: 'Gerenciar Quadras e Grade de Horários',
        detail: 'Na aba "Painel Admin", ative ou desative quadras e defina horários de abertura/fechamento para cada dia da semana.',
      },
      {
        number: 3,
        title: 'Bloqueio de Horários (Manutenção e Torneios)',
        detail: 'Precisa fechar a quadra para aula, manutenção ou campeonato? Bloqueie horários específicos diretamente na agenda.',
      },
      {
        number: 4,
        title: 'Promover Outros Administradores',
        detail: 'Na lista de membros, altere o perfil de um jogador confiável para "Administrador" para dividir o gerenciamento.'
      }
    ]
  },
  {
    title: '4. Manual do Jogador (Agendamentos e Desafios)',
    category: 'Jogador',
    icon: '🎾',
    badgeColor: '#d97706', // amber
    description: 'Como buscar horários, reservar quadras, montar jogos de simples ou duplas e acompanhar o histórico.',
    steps: [
      {
        number: 1,
        title: 'Cadastrar com o Código de Convite do Grupo',
        detail: 'Ao se cadastrar como Jogador, digite obrigatoriamente o Código de Convite fornecido pelo seu clube de tênis. Isso garante o vínculo direto com o grupo correto.',
        tip: 'Se o seu clube ainda não possui um grupo cadastrado, solicite ao proprietário ou gestor para clicar em "Criar Meu Grupo".'
      },
      {
        number: 2,
        title: 'Navegar pela Agenda de Quadras',
        detail: 'Na aba "Agenda", selecione a data desejada no calendário superior e escolha a Quadra pretendida.',
      },
      {
        number: 3,
        title: 'Reservar um Horário Vago',
        detail: 'Clique em um slot disponível no horário desejado. Escolha a modalidade: Simples (1 contra 1) ou Duplas (2 contra 2).',
        tip: 'Selecione seus parceiros de jogo na lista de membros para que eles também recebam notificação.'
      },
      {
        number: 4,
        title: 'Minhas Reservas e Cancelamentos',
        detail: 'Na aba "Minhas Reservas", veja todos os seus jogos confirmados. Caso não possa ir, cancele com antecedência para liberar a quadra.',
      }
    ]
  }
];

export function generateUserManualPdf() {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const pageWidth = doc.internal.pageSize.getWidth(); // 210mm
  const pageHeight = doc.internal.pageSize.getHeight(); // 297mm
  const margin = 15;
  const contentWidth = pageWidth - margin * 2; // 180mm

  let y = margin;

  const sanitizePdfText = (text: string) =>
    text
      .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, '')
      .replace(/\s+/g, ' ')
      .trim();

  // Helper function to check page overflow
  const checkNewPage = (neededSpace: number) => {
    if (y + neededSpace > pageHeight - 15) {
      doc.addPage();
      y = margin;
      drawHeaderFooter();
    }
  };

  const drawHeaderFooter = () => {
    // Top mini bar
    doc.setFillColor(234, 88, 12); // Orange 600
    doc.rect(0, 0, pageWidth, 4, 'F');

    // Page footer
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184); // slate-400
    doc.text('TennisPlay — Guia do Usuário & Manual de Instruções', margin, pageHeight - 8);
    const totalPages = doc.getNumberOfPages();
    doc.text(`Página ${totalPages}`, pageWidth - margin, pageHeight - 8, { align: 'right' });
  };

  // --- COVER / HEADER BANNER ---
  drawHeaderFooter();

  // Header Box
  doc.setFillColor(15, 23, 42); // slate-900
  doc.roundedRect(margin, y, contentWidth, 38, 4, 4, 'F');

  // Title inside Box
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.setTextColor(255, 255, 255);
  doc.text('TennisPlay — Manual de Uso', margin + 8, y + 14);

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(209, 213, 219);
  doc.text('Guia Passo a Passo: Criar Grupo | Administrador | Jogador', margin + 8, y + 23);

  doc.setFillColor(234, 88, 12); // Orange 600
  doc.roundedRect(margin + 8, y + 28, 55, 6, 2, 2, 'F');
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(255, 255, 255);
  doc.text('DOCUMENTO OFICIAL', margin + 12, y + 32);

  y += 46;

  // Introduction Paragraph
  doc.setFontSize(9.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(51, 65, 85); // slate-700
  const introText = 'Este manual contém todas as orientações necessárias para cadastrar, criar grupos de tênis, gerenciar permissões administrativas e agendar quadras na plataforma TennisPlay.';
  const splitIntro = doc.splitTextToSize(introText, contentWidth);
  doc.text(splitIntro, margin, y);
  y += splitIntro.length * 5 + 6;

  // --- RENDER SECTIONS ---
  MANUAL_DATA.forEach((sec) => {
    checkNewPage(25);

    // Section Title Box
    doc.setFillColor(241, 245, 249); // slate-100
    doc.roundedRect(margin, y, contentWidth, 10, 2, 2, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(15, 23, 42);
    doc.text(sanitizePdfText(sec.title), margin + 4, y + 6.8);

    y += 13;

    // Section Description
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(8.5);
    doc.setTextColor(100, 116, 139);
    const splitDesc = doc.splitTextToSize(sec.description, contentWidth - 4);
    doc.text(splitDesc, margin + 2, y);
    y += splitDesc.length * 4 + 4;

    // Render Steps
    sec.steps.forEach((step) => {
      checkNewPage(22);

      // Step Number circle/box
      doc.setFillColor(234, 88, 12); // Orange 600
      doc.roundedRect(margin + 2, y, 7, 7, 1.5, 1.5, 'F');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(255, 255, 255);
      doc.text(`${step.number}`, margin + 4.5, y + 4.8, { align: 'center' });

      // Step Title
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9.5);
      doc.setTextColor(15, 23, 42);
      doc.text(step.title, margin + 12, y + 5);

      y += 8;

      // Step Detail
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(51, 65, 85);
      const splitDetail = doc.splitTextToSize(step.detail, contentWidth - 14);
      doc.text(splitDetail, margin + 12, y);
      y += splitDetail.length * 4;

      // Tip Box if exists
      if (step.tip) {
        checkNewPage(12);
        doc.setFillColor(255, 247, 237); // orange-50
        doc.setDrawColor(254, 215, 170); // orange-200
        doc.roundedRect(margin + 12, y + 1, contentWidth - 14, 8, 1.5, 1.5, 'FD');

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7.5);
        doc.setTextColor(194, 65, 12); // orange-700
        doc.text('Dica: ' + step.tip, margin + 15, y + 6);
        y += 11;
      } else {
        y += 3;
      }
    });

    y += 5; // Spacing after section
  });

  // Save the PDF
  doc.save('Manual_Instrucoes_TennisPlay.pdf');
}
