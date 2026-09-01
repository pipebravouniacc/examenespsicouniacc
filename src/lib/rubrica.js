// Rúbrica oficial Examen de Título y Grado · Psicología UNIACC
// Cada criterio se puntúa 1–7 (descriptores en 1, 3, 5, 7; se admiten 2, 4, 6 intermedios).

export const NIVELES = [
  { puntos: 7, nombre: 'Avanzado' },
  { puntos: 5, nombre: 'Competente' },
  { puntos: 3, nombre: 'Desempeño inicial' },
  { puntos: 1, nombre: 'Necesita mejora' },
]

export const RUBRICA = {
  presentacion: {
    titulo: 'Presentación de la investigación',
    grupal: {
      titulo: 'Criterios disciplinares · Evaluación grupal',
      criterios: [
        {
          id: 'p_fund',
          indicador: 'Fundamentación de decisiones teóricas y metodológicas',
          criterio:
            'Argumenta de manera fundamentada y con claridad las decisiones teóricas, metodológicas y procedimentales, reconociendo los alcances y límites del proceso investigativo.',
          niveles: {
            7: 'Explicitan y justifican de manera adecuada las decisiones teóricas y metodológicas del proceso investigativo, reconociendo alcances, limitaciones y criterios disciplinares.',
            5: 'Describen las decisiones teóricas y metodológicas del proceso investigativo, pero la justificación es parcial o poco profundizada.',
            3: 'Señalan las decisiones teóricas y/o metodológicas del proceso investigativo, pero no se justifican en referencia a criterios disciplinares.',
            1: 'No fundamentan las decisiones teórico-metodológicas de la investigación.',
          },
        },
        {
          id: 'p_coh',
          indicador: 'Coherencia del proceso investigativo',
          criterio:
            'Presentan el proceso investigativo demostrando coherencia interna entre sus distintos componentes.',
          niveles: {
            7: 'La presentación evidencia un proceso investigativo plenamente coherente: introducción, metodología, resultados y discusión se articulan lógicamente, sin contradicciones ni vacíos relevantes.',
            5: 'La presentación evidencia un proceso investigativo mayoritariamente coherente, pero se presentan desajustes menores entre los distintos componentes.',
            3: 'La presentación evidencia un proceso investigativo con una articulación débil entre sus componentes, con inconsistencias o vacíos conceptuales y/o metodológicos relevantes.',
            1: 'La presentación no logra identificar una coherencia clara entre los componentes centrales de la investigación.',
          },
        },
      ],
    },
    individual: {
      titulo: 'Criterios transversales · Evaluación individual',
      criterios: [
        {
          id: 'p_leng',
          indicador: 'Uso de lenguaje técnico y precisión conceptual',
          criterio: 'Utiliza términos disciplinares con coherencia y propiedad.',
          niveles: {
            7: 'Utiliza lenguaje técnico propio de la disciplina con precisión conceptual y coherente con el marco de la investigación presentada. Sin errores relevantes en la sección que expone.',
            5: 'Utiliza lenguaje técnico adecuado, aunque con imprecisiones menores o uso ocasional de términos genéricos.',
            3: 'Presenta dificultades en el uso de conceptos disciplinares o estos son poco coherentes con el marco de la investigación. Recurre a explicaciones vagas y poco precisas.',
            1: 'El uso del lenguaje técnico es incorrecto o utiliza términos coloquiales que dificultan la comprensión del contenido.',
          },
        },
        {
          id: 'p_clar',
          indicador: 'Claridad expositiva y estructura del discurso oral',
          criterio:
            'Comunica con claridad, formalidad y capacidad de síntesis, acorde a la situación de evaluación.',
          niveles: {
            7: 'Expone con claridad, orden lógico, adecuado ajuste al tiempo y fluidez argumentativa.',
            5: 'Expone de manera comprensible, aunque presenta desorganización menor en algunos elementos de su exposición o desajustes temporales.',
            3: 'La exposición resulta poco clara, con dificultades de orden, síntesis o continuidad que entorpecen la comprensión.',
            1: 'La exposición es confusa, desestructurada o impide comprender el contenido presentado.',
          },
        },
      ],
    },
  },
  defensa: {
    titulo: 'Defensa de grado',
    disciplinares: {
      titulo: 'Criterios disciplinares · Evaluación individual',
      criterios: [
        {
          id: 'd_refl',
          indicador: 'Reflexión crítica sobre el proceso investigativo y sus implicancias',
          criterio:
            'Reflexiona de manera crítica e integrada sobre las decisiones del proceso investigativo, analizando las implicancias éticas y profesionales de los hallazgos en relación con el rol del psicólogo/a.',
          niveles: {
            7: 'Reflexiona de manera integrada y crítica sobre las decisiones del proceso investigativo, analizando sus implicancias éticas y profesionales, y vinculando claramente los hallazgos con el rol del psicólogo/a.',
            5: 'Reflexiona sobre el proceso y los hallazgos, pero de forma parcial: aborda las implicancias éticas o profesionales sin integrarlas plenamente entre sí o con las decisiones metodológicas presentadas.',
            3: 'Describe aspectos del proceso investigativo o menciona implicancias éticas/profesionales de manera superficial o refiriéndose sólo a lo ya presentado, sin un análisis crítico ni articulación clara.',
            1: 'No logra reflexionar sobre el proceso investigativo ni sobre las implicancias éticas o profesionales de los hallazgos.',
          },
        },
        {
          id: 'd_proy',
          indicador: 'Proyección profesional situada e interdisciplinariedad',
          criterio:
            'Proyecta los hallazgos de la investigación hacia la práctica profesional de manera situada y pertinente, valorando la interdisciplinariedad cuando resulta relevante para el abordaje del problema estudiado.',
          niveles: {
            7: 'Proyecta los hallazgos de la investigación hacia la práctica profesional de forma situada y viable, incorporando una valoración pertinente de la interdisciplinariedad cuando el problema lo requiere.',
            5: 'Propone proyecciones profesionales generales, con referencia limitada al contexto específico de desempeño del psicólogo/a o a la articulación interdisciplinaria.',
            3: 'Las proyecciones son genéricas o poco fundamentadas, sin vinculación clara con los hallazgos ni con otros campos disciplinares.',
            1: 'No logra proyectar los resultados de la investigación hacia la práctica profesional ni reconocer aportes de otras disciplinas.',
          },
        },
      ],
    },
    transversales: {
      titulo: 'Criterios transversales · Evaluación individual',
      criterios: [
        {
          id: 'd_dial',
          indicador: 'Participación en el diálogo profesional y argumentación disciplinar',
          criterio:
            'Participa activamente en el diálogo profesional durante la defensa, argumentando de manera coherente, utilizando lenguaje técnico disciplinar y manteniendo consistencia con lo presentado en la investigación.',
          niveles: {
            7: 'Participa activamente en el diálogo profesional, argumenta con coherencia, utiliza lenguaje técnico preciso y responde de manera consistente con lo presentado en la investigación.',
            5: 'Argumenta adecuadamente y utiliza lenguaje técnico, aunque con imprecisiones menores o respuestas parcialmente coherentes con lo presentado.',
            3: 'Presenta dificultades para sostener la argumentación, utiliza lenguaje técnico limitado o responde de forma poco articulada con la investigación. Uso de términos coloquiales que es capaz de corregir con la ayuda de la comisión.',
            1: 'No logra sostener un diálogo profesional ni utilizar adecuadamente el lenguaje disciplinar, o usa términos coloquiales que dificultan la comprensión o incurren en errores.',
          },
        },
        {
          id: 'd_form',
          indicador: 'Claridad y formalidad comunicativa',
          criterio:
            'Se comunica de manera clara, estructurada y formal durante la defensa, manteniendo una actitud profesional acorde al contexto académico-evaluativo.',
          niveles: {
            7: 'Se comunica con claridad, orden lógico y formalidad académica, manteniendo una actitud profesional durante toda la defensa. Reconoce limitaciones con honestidad académica.',
            5: 'La comunicación es comprensible y formal, aunque con desajustes menores en claridad, orden o manejo del discurso oral.',
            3: 'La comunicación presenta dificultades relevantes de claridad, estructura o registro formal.',
            1: 'La falta de claridad o formalidad dificulta significativamente la comprensión de la defensa.',
          },
        },
      ],
    },
  },
}

// Tabla oficial de conversión puntaje (0–28) → nota (1.0–7.0)
export const TABLA_NOTAS = [
  1.0, 1.2, 1.4, 1.5, 1.7, 1.9, 2.1, 2.3, 2.4, 2.6,
  2.8, 3.0, 3.1, 3.3, 3.5, 3.7, 3.9, 4.1, 4.3, 4.6,
  4.9, 5.1, 5.4, 5.7, 5.9, 6.2, 6.5, 6.7, 7.0,
]

export const notaDesdePuntaje = (p) => {
  const i = Math.max(0, Math.min(28, Math.round(p)))
  return TABLA_NOTAS[i]
}

export const NOTA_APROBACION = 4.0

// Ids de criterios individuales por momento
export const CRIT_PRES_IND = ['p_leng', 'p_clar']
export const CRIT_DEF = ['d_refl', 'd_proy', 'd_dial', 'd_form']
export const CRIT_PRES_GRUPAL = ['p_fund', 'p_coh']
