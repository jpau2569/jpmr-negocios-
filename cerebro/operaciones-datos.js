/* ═══════════════════════════════════════════════════════════════════
   CEREBRO ÚTIL PAU — datos de las operaciones (compraventa y alquiler)
   Preparados y verificados por NURIA (equipo de Clara) con fuentes
   oficiales o serias, consultadas en septiembre de 2026. Cada papel
   indica quién lo aporta, si es obligatorio, habitual o según el caso,
   y su fuente. Lo que no se pudo verificar lo dice en su "nota".
   Si cambia la normativa (ITP, fianzas en Asturias…), se actualiza aquí.
   ═══════════════════════════════════════════════════════════════════ */

export const DATOS_OPERACIONES = {
  "compraventa": [
    {
      "fase": "reserva",
      "titulo": "Reserva",
      "explicacion": "El comprador entrega una cantidad para que el inmueble se retire del mercado mientras se prepara el contrato de arras. No está regulada por una ley específica: es un acuerdo privado que debe decir qué pasa con la cantidad si no se llega a arras.",
      "papeles": [
        {
          "id": "doc-reserva",
          "nombre": "Documento de reserva o propuesta de compra firmada",
          "aporta": "agencia",
          "caracter": "habitual",
          "nota": "Precio, plazo para firmar arras y destino de la cantidad entregada.",
          "fuente": ""
        },
        {
          "id": "dni-partes",
          "nombre": "DNI/NIE de comprador y vendedor",
          "aporta": "comprador",
          "caracter": "habitual",
          "nota": "Solo para identificar a las partes; en notaría será obligatorio.",
          "fuente": ""
        },
        {
          "id": "nota-simple",
          "nombre": "Nota simple del Registro de la Propiedad",
          "aporta": "agencia",
          "caracter": "habitual",
          "nota": "Comprueba titular y cargas. No la exige la ley, pero es la forma de saber quién es el dueño y qué cargas tiene.",
          "fuente": "https://www.registradores.org"
        },
        {
          "id": "justificante-reserva",
          "nombre": "Justificante del pago de la reserva",
          "aporta": "comprador",
          "caracter": "habitual",
          "nota": "Mejor por transferencia.",
          "fuente": ""
        }
      ],
      "plazos": []
    },
    {
      "fase": "arras",
      "titulo": "Contrato de arras",
      "explicacion": "Contrato privado de compraventa con entrega de una señal (habitualmente el 10 %, no es un porcentaje legal). Penitenciales (art. 1454 CC): permiten desistir; el comprador pierde la señal o el vendedor la devuelve doblada. Confirmatorias: la señal es anticipo del precio y no permiten desistir. Penales: castigo por incumplir, sin impedir exigir el cumplimiento.",
      "papeles": [
        {
          "id": "contrato-arras",
          "nombre": "Contrato de arras (indicar el tipo expresamente)",
          "aporta": "agencia",
          "caracter": "habitual",
          "nota": "Si se quieren penitenciales hay que decirlo expresamente y citar el art. 1454 CC.",
          "fuente": "https://www.boe.es/buscar/act.php?id=BOE-A-1889-4763"
        },
        {
          "id": "nota-simple-arras",
          "nombre": "Nota simple actualizada",
          "aporta": "agencia",
          "caracter": "habitual",
          "nota": "Pedirla justo antes de firmar arras.",
          "fuente": "https://www.registradores.org"
        },
        {
          "id": "cee",
          "nombre": "Certificado de eficiencia energética y etiqueta",
          "aporta": "vendedor",
          "caracter": "obligatorio",
          "nota": "Debe existir desde que se anuncia la venta y entregarse al comprador. Validez 10 años (5 si la calificación es G).",
          "fuente": "https://www.boe.es/buscar/act.php?id=BOE-A-2021-9176"
        },
        {
          "id": "ibi",
          "nombre": "Último recibo del IBI (referencia catastral)",
          "aporta": "vendedor",
          "caracter": "habitual",
          "nota": "Identifica el inmueble por su referencia catastral.",
          "fuente": "https://www.boe.es/buscar/act.php?id=BOE-A-2004-4163"
        },
        {
          "id": "justificante-arras",
          "nombre": "Justificante del pago de las arras",
          "aporta": "comprador",
          "caracter": "habitual",
          "nota": "Por transferencia; se identificará en la escritura como medio de pago.",
          "fuente": ""
        }
      ],
      "plazos": [
        {
          "id": "arras-escritura",
          "nombre": "Fecha límite para firmar la escritura (pactada en arras)",
          "dias": 90,
          "tipoDias": "naturales",
          "desde": "firma del contrato de arras",
          "fuente": ""
        }
      ]
    },
    {
      "fase": "hipoteca",
      "titulo": "Hipoteca",
      "explicacion": "Solo si el comprador financia. El banco tasa, emite la FEIN (oferta vinculante) y la FiAE con el proyecto de contrato. Deben pasar al menos 10 días naturales antes de firmar y el comprador firma antes el acta previa gratuita en la notaría que elija.",
      "papeles": [
        {
          "id": "doc-solvencia",
          "nombre": "Nóminas, IRPF y vida laboral del comprador",
          "aporta": "comprador",
          "caracter": "segun-caso",
          "nota": "Lo que pida cada banco.",
          "fuente": ""
        },
        {
          "id": "tasacion",
          "nombre": "Tasación por sociedad homologada",
          "aporta": "banco",
          "caracter": "segun-caso",
          "nota": "Obligatoria si hay hipoteca. El comprador puede aportar una propia válida.",
          "fuente": "https://www.boe.es/buscar/act.php?id=BOE-A-2019-3814"
        },
        {
          "id": "fein-fiae",
          "nombre": "FEIN, FiAE y proyecto de contrato",
          "aporta": "banco",
          "caracter": "obligatorio",
          "nota": "Al menos 10 días naturales antes de la firma (art. 14 Ley 5/2019).",
          "fuente": "https://www.boe.es/buscar/act.php?id=BOE-A-2019-3814"
        },
        {
          "id": "acta-previa",
          "nombre": "Acta notarial previa de transparencia",
          "aporta": "notaria",
          "caracter": "obligatorio",
          "nota": "Gratuita. Sin ella el notario no autoriza la hipoteca (art. 15 Ley 5/2019).",
          "fuente": "https://www.boe.es/buscar/act.php?id=BOE-A-2019-3814"
        }
      ],
      "plazos": [
        {
          "id": "fein-10-dias",
          "nombre": "Espera mínima entre FEIN y firma de la hipoteca",
          "dias": 10,
          "tipoDias": "naturales",
          "desde": "entrega de la FEIN y la documentación del art. 14",
          "fuente": "https://www.boe.es/buscar/act.php?id=BOE-A-2019-3814"
        }
      ]
    },
    {
      "fase": "documentacion",
      "titulo": "Documentación para la notaría",
      "explicacion": "La agencia reúne y envía a la notaría lo del inmueble y de las partes para que prepare el borrador de escritura. La notaría obtiene además la información registral.",
      "papeles": [
        {
          "id": "dni-partes-documentacion",
          "nombre": "DNI/NIE de todas las partes y régimen económico matrimonial",
          "aporta": "comprador",
          "caracter": "obligatorio",
          "nota": "Lo aportan comprador y vendedor.",
          "fuente": ""
        },
        {
          "id": "escritura-anterior",
          "nombre": "Escritura de propiedad anterior",
          "aporta": "vendedor",
          "caracter": "habitual",
          "nota": "Si no la tiene, la notaría trabaja con la información registral.",
          "fuente": ""
        },
        {
          "id": "nota-simple-documentacion",
          "nombre": "Nota simple / información registral",
          "aporta": "agencia",
          "caracter": "habitual",
          "nota": "La notaría la pide igualmente antes de la firma.",
          "fuente": "https://www.registradores.org"
        },
        {
          "id": "ref-catastral",
          "nombre": "Referencia catastral",
          "aporta": "vendedor",
          "caracter": "obligatorio",
          "nota": "Debe constar en la escritura (TR Ley del Catastro, arts. 38-41).",
          "fuente": "https://www.boe.es/buscar/act.php?id=BOE-A-2004-4163"
        },
        {
          "id": "ibi-documentacion",
          "nombre": "Último recibo del IBI pagado",
          "aporta": "vendedor",
          "caracter": "habitual",
          "nota": "El inmueble responde del IBI impagado (art. 64 TRLRHL).",
          "fuente": "https://www.boe.es/buscar/act.php?id=BOE-A-2004-4214"
        },
        {
          "id": "cert-comunidad",
          "nombre": "Certificado de la comunidad de estar al corriente de pagos",
          "aporta": "vendedor",
          "caracter": "obligatorio",
          "nota": "Art. 9.1.e LPH: sin él no se autoriza la escritura salvo que el comprador lo exonere expresamente. Lo emite el secretario con el visto bueno del presidente en máx. 7 días naturales.",
          "fuente": "https://www.boe.es/buscar/act.php?id=BOE-A-1960-10906"
        },
        {
          "id": "cee-documentacion",
          "nombre": "Certificado de eficiencia energética",
          "aporta": "vendedor",
          "caracter": "obligatorio",
          "nota": "RD 390/2021.",
          "fuente": "https://www.boe.es/buscar/act.php?id=BOE-A-2021-9176"
        },
        {
          "id": "cedula-habitabilidad",
          "nombre": "Cédula de habitabilidad de segunda ocupación (Asturias)",
          "aporta": "vendedor",
          "caracter": "segun-caso",
          "nota": "Asturias la mantiene para 2.ª y posteriores ocupaciones (Decreto 73/2018) y es necesaria para contratar suministros. Si la notaría la exige para escriturar: SIN VERIFICAR, preguntar a la notaría.",
          "fuente": "https://miprincipado.asturias.es/-/dboid-6269000008031115007573"
        },
        {
          "id": "cert-deuda-hipoteca",
          "nombre": "Certificado de deuda pendiente de la hipoteca del vendedor",
          "aporta": "vendedor",
          "caracter": "segun-caso",
          "nota": "Solo si queda hipoteca; lo emite su banco.",
          "fuente": ""
        },
        {
          "id": "cancelacion-hipoteca",
          "nombre": "Cancelación económica y registral de la hipoteca anterior",
          "aporta": "banco",
          "caracter": "segun-caso",
          "nota": "Lo habitual es pagarla en la misma firma con parte del precio.",
          "fuente": ""
        },
        {
          "id": "cert-instalaciones",
          "nombre": "Certificados de instalaciones (electricidad, gas)",
          "aporta": "vendedor",
          "caracter": "segun-caso",
          "nota": "Para cambiar o dar de alta suministros si la instalación es antigua.",
          "fuente": ""
        },
        {
          "id": "justificantes-pagos",
          "nombre": "Justificantes de reserva y arras",
          "aporta": "comprador",
          "caracter": "habitual",
          "nota": "La escritura identifica los medios de pago.",
          "fuente": ""
        }
      ],
      "plazos": [
        {
          "id": "cert-comunidad-7",
          "nombre": "Plazo máximo para emitir el certificado de la comunidad",
          "dias": 7,
          "tipoDias": "naturales",
          "desde": "solicitud al secretario",
          "fuente": "https://www.boe.es/buscar/act.php?id=BOE-A-1960-10906"
        }
      ]
    },
    {
      "fase": "notaria",
      "titulo": "Firma en notaría",
      "explicacion": "Se firma la escritura de compraventa (y la hipoteca si la hay), se paga el resto del precio, se cancela la hipoteca del vendedor si procede y el notario envía copia al Registro. Si el vendedor no es residente, el comprador retiene el 3 % y lo ingresa en Hacienda (modelo 211).",
      "papeles": [
        {
          "id": "dni-originales",
          "nombre": "DNI/NIE originales",
          "aporta": "comprador",
          "caracter": "obligatorio",
          "nota": "Todas las partes.",
          "fuente": ""
        },
        {
          "id": "medio-pago",
          "nombre": "Cheque bancario o transferencia del resto del precio",
          "aporta": "comprador",
          "caracter": "obligatorio",
          "nota": "La escritura debe identificar los medios de pago.",
          "fuente": ""
        },
        {
          "id": "retencion-no-residente",
          "nombre": "Retención del 3 % (modelo 211)",
          "aporta": "comprador",
          "caracter": "segun-caso",
          "nota": "Solo si el vendedor no es residente en España.",
          "fuente": "https://sede.agenciatributaria.gob.es"
        }
      ],
      "plazos": []
    },
    {
      "fase": "llaves",
      "titulo": "Entrega de llaves",
      "explicacion": "Normalmente en el acto de la firma. Se leen contadores y se cambian titulares de luz, agua y gas.",
      "papeles": [
        {
          "id": "llaves",
          "nombre": "Llaves y mandos",
          "aporta": "vendedor",
          "caracter": "habitual",
          "nota": "",
          "fuente": ""
        },
        {
          "id": "lectura-contadores",
          "nombre": "Lectura de contadores y CUPS",
          "aporta": "vendedor",
          "caracter": "habitual",
          "nota": "Para el cambio de titular de suministros.",
          "fuente": ""
        },
        {
          "id": "cedula-habitabilidad-llaves",
          "nombre": "Cédula de habitabilidad para suministros",
          "aporta": "vendedor",
          "caracter": "segun-caso",
          "nota": "En Asturias las suministradoras no formalizan contratos definitivos sin ella.",
          "fuente": "https://miprincipado.asturias.es/-/dboid-6269000008031115007573"
        }
      ],
      "plazos": []
    },
    {
      "fase": "postfirma",
      "titulo": "Después de la notaría",
      "explicacion": "Pago del ITP (comprador), plusvalía municipal (vendedor, con comunicación del comprador), inscripción en el Registro. ITP Asturias 2026: 8 % hasta 300.000 €, 9 % de 300.000 a 500.000 € y 10 % por encima; tipos reducidos para vivienda habitual según requisitos (DL 2/2014).",
      "papeles": [
        {
          "id": "modelo-600",
          "nombre": "ITP: modelo 600 ante el Principado de Asturias",
          "aporta": "comprador",
          "caracter": "obligatorio",
          "nota": "Solo presentado en la sede del Ente Público de Servicios Tributarios o en sus oficinas. Suele gestionarlo la gestoría.",
          "fuente": "https://sede.tributasenasturias.es/sites/sede/default/es_ES/Que-quieres-hacer/Transmisiones-Patrimoniales-y-AJD/Guia-del-impuesto/Modalidad-Transmisiones-Patrimoniales-Onerosas"
        },
        {
          "id": "plusvalia",
          "nombre": "Plusvalía municipal (IIVTNU)",
          "aporta": "vendedor",
          "caracter": "obligatorio",
          "nota": "En compraventa la paga el vendedor.",
          "fuente": "https://sede.oviedo.es/tramites/tributos-y-economia/declaracion-tributaria-del-iivtnu-para-transmisiones-inter-vivos"
        },
        {
          "id": "comunicacion-plusvalia",
          "nombre": "Comunicación de la transmisión al Ayuntamiento",
          "aporta": "comprador",
          "caracter": "obligatorio",
          "nota": "Art. 110.6 TRLRHL; Oviedo tiene trámite propio.",
          "fuente": "https://sede.oviedo.es/tramites/tributos-y-economia/comunicacion-del-comprador-sobre-el-iivtnu"
        },
        {
          "id": "inscripcion-registro",
          "nombre": "Inscripción en el Registro de la Propiedad",
          "aporta": "comprador",
          "caracter": "habitual",
          "nota": "Tras pagar el ITP; la tramita la gestoría.",
          "fuente": "https://www.registradores.org"
        }
      ],
      "plazos": [
        {
          "id": "itp-30",
          "nombre": "Presentar y pagar el ITP (modelo 600)",
          "dias": 30,
          "tipoDias": "habiles",
          "desde": "firma de la escritura",
          "fuente": "https://sede.tributasenasturias.es/sites/sede/default/es_ES/Que-quieres-hacer/Transmisiones-Patrimoniales-y-AJD/Guia-del-impuesto/Modalidad-Transmisiones-Patrimoniales-Onerosas"
        },
        {
          "id": "plusvalia-30",
          "nombre": "Plusvalía municipal (Oviedo)",
          "dias": 30,
          "tipoDias": "habiles",
          "desde": "firma de la escritura",
          "fuente": "https://sede.oviedo.es/tramites/tributos-y-economia/declaracion-tributaria-del-iivtnu-para-transmisiones-inter-vivos"
        }
      ]
    }
  ],
  "alquiler": [
    {
      "fase": "reserva",
      "titulo": "Reserva",
      "explicacion": "El interesado reserva el piso. No está regulada. En vivienda habitual no se pueden cobrar al inquilino honorarios ni gastos de gestión: lo limpio es que la reserva se descuente de la fianza o de la primera renta.",
      "papeles": [
        {
          "id": "doc-reserva-alquiler",
          "nombre": "Documento de reserva",
          "aporta": "agencia",
          "caracter": "habitual",
          "nota": "Decir a qué se imputa la cantidad.",
          "fuente": ""
        }
      ],
      "plazos": []
    },
    {
      "fase": "documentacion",
      "titulo": "Documentación",
      "explicacion": "El propietario aporta los papeles del piso y el inquilino se identifica y acredita solvencia (solo lo imprescindible).",
      "papeles": [
        {
          "id": "dni-inquilino",
          "nombre": "DNI/NIE del inquilino",
          "aporta": "inquilino",
          "caracter": "obligatorio",
          "nota": "Aquí 'comprador' = inquilino.",
          "fuente": ""
        },
        {
          "id": "solvencia",
          "nombre": "Acreditación de solvencia (nómina, contrato)",
          "aporta": "inquilino",
          "caracter": "segun-caso",
          "nota": "A criterio del propietario; pedir el mínimo imprescindible.",
          "fuente": ""
        },
        {
          "id": "cee",
          "nombre": "Certificado de eficiencia energética y etiqueta",
          "aporta": "propietario",
          "caracter": "obligatorio",
          "nota": "También en alquiler a un nuevo inquilino. Aquí 'vendedor' = propietario.",
          "fuente": "https://www.boe.es/buscar/act.php?id=BOE-A-2021-9176"
        },
        {
          "id": "nota-simple",
          "nombre": "Nota simple o escritura del propietario",
          "aporta": "propietario",
          "caracter": "habitual",
          "nota": "Comprueba que quien alquila es el dueño.",
          "fuente": "https://www.registradores.org"
        },
        {
          "id": "cedula-habitabilidad",
          "nombre": "Cédula de habitabilidad de segunda ocupación",
          "aporta": "propietario",
          "caracter": "segun-caso",
          "nota": "Necesaria para que el inquilino contrate suministros a su nombre en Asturias.",
          "fuente": "https://miprincipado.asturias.es/-/dboid-6269000008031115007573"
        }
      ],
      "plazos": []
    },
    {
      "fase": "firma",
      "titulo": "Firma del contrato",
      "explicacion": "Duración mínima 5 años (7 si el arrendador es persona jurídica) con prórroga obligatoria (art. 9 LAU). Los honorarios de la agencia y los gastos de formalización son del arrendador en vivienda habitual (art. 20.1 LAU tras la Ley 12/2023).",
      "papeles": [
        {
          "id": "contrato-alquiler",
          "nombre": "Contrato de arrendamiento de vivienda",
          "aporta": "agencia",
          "caracter": "habitual",
          "nota": "Adjuntar copia del CEE.",
          "fuente": "https://www.boe.es/buscar/act.php?id=BOE-A-1994-26003"
        },
        {
          "id": "inventario",
          "nombre": "Inventario y fotos del estado",
          "aporta": "agencia",
          "caracter": "habitual",
          "nota": "Evita discusiones al devolver la fianza.",
          "fuente": ""
        },
        {
          "id": "honorarios-arrendador",
          "nombre": "Factura de honorarios de la agencia al arrendador",
          "aporta": "agencia",
          "caracter": "obligatorio",
          "nota": "Nunca al inquilino en vivienda habitual (art. 20.1 LAU).",
          "fuente": "https://www.boe.es/buscar/act.php?id=BOE-A-2023-12203"
        }
      ],
      "plazos": []
    },
    {
      "fase": "fianza",
      "titulo": "Fianza",
      "explicacion": "Una mensualidad en metálico (art. 36.1 LAU); garantía adicional máxima de 2 mensualidades (art. 36.5). En Asturias hoy no hay obligación de depositarla en ningún organismo (Decreto 48/2010): la custodia el propietario. Un proyecto de Ley de Vivienda del Principado podría volver a exigirlo (SIN VERIFICAR a 26/09/2026).",
      "papeles": [
        {
          "id": "fianza",
          "nombre": "Fianza de una mensualidad",
          "aporta": "inquilino",
          "caracter": "obligatorio",
          "nota": "Aquí 'comprador' = inquilino.",
          "fuente": "https://www.boe.es/buscar/act.php?id=BOE-A-1994-26003"
        },
        {
          "id": "deposito-fianza-asturias",
          "nombre": "Depósito de la fianza en organismo autonómico",
          "aporta": "propietario",
          "caracter": "segun-caso",
          "nota": "No obligatorio en Asturias desde el Decreto 48/2010. Revisar si la Ley de Vivienda de Asturias ha cambiado esto.",
          "fuente": "https://noticias.juridicas.com/base_datos/CCAA/as-d48-2010.html"
        }
      ],
      "plazos": []
    },
    {
      "fase": "llaves",
      "titulo": "Entrega de llaves",
      "explicacion": "Lectura de contadores, cambio de titular de suministros y entrega de copia del certificado energético.",
      "papeles": [
        {
          "id": "lectura-contadores",
          "nombre": "Lectura de contadores",
          "aporta": "agencia",
          "caracter": "habitual",
          "nota": "",
          "fuente": ""
        },
        {
          "id": "llaves",
          "nombre": "Llaves y mandos",
          "aporta": "propietario",
          "caracter": "habitual",
          "nota": "",
          "fuente": ""
        }
      ],
      "plazos": []
    }
  ],
  "mensajes": [
    {
      "id": "comprador-documentacion",
      "para": "comprador",
      "titulo": "Pedir documentación al comprador",
      "texto": "Hola {comprador}, soy {agente}, de Asesoría Castresana. Para preparar la firma de {inmueble} necesito que me mandes: foto del DNI/NIE por las dos caras, justificante de la transferencia de las arras y, si vas con hipoteca, el nombre y teléfono de tu gestor del banco. Si tienes cualquier duda, me dices. ¡Gracias!",
      "tipo": "compraventa"
    },
    {
      "id": "comprador-notaria",
      "para": "comprador",
      "titulo": "Recordar la cita en notaría",
      "texto": "Hola {comprador}, te recuerdo la firma de {inmueble}: {fecha} a las {hora} en la notaría {notaria}. Trae el DNI/NIE original y el medio de pago que acordamos. Si vas con hipoteca, recuerda que antes tienes que firmar el acta previa en la notaría. Nos vemos allí. {agente}",
      "tipo": "compraventa"
    },
    {
      "id": "comprador-acta-previa",
      "para": "comprador",
      "titulo": "Acta previa de la hipoteca",
      "texto": "Hola {comprador}, el banco ya te ha enviado la FEIN. Desde ese día tienen que pasar al menos 10 días naturales antes de firmar la hipoteca, y antes de la firma tienes que pasar por la notaría {notaria} para el acta previa (es gratuita). ¿Te va bien el {fecha} a las {hora}? {agente}",
      "tipo": "compraventa"
    },
    {
      "id": "vendedor-papeles",
      "para": "vendedor",
      "titulo": "Pedir papeles al vendedor",
      "texto": "Hola {vendedor}, soy {agente}. Para avanzar con la venta de {inmueble} necesito: nota simple (la pido yo si quieres), último recibo del IBI pagado, certificado de la comunidad de estar al corriente de pagos (lo firma el secretario con el visto bueno del presidente), certificado energético en vigor y, si la tienes, la cédula de habitabilidad. Si aún queda hipoteca, pide a tu banco el certificado de deuda pendiente. ¡Gracias!",
      "tipo": "compraventa"
    },
    {
      "id": "vendedor-notaria",
      "para": "vendedor",
      "titulo": "Recordar la cita en notaría",
      "texto": "Hola {vendedor}, te confirmo la firma de {inmueble}: {fecha} a las {hora} en la notaría {notaria}. Trae tu DNI/NIE original, las llaves y los mandos. Si hay hipoteca por cancelar, tu banco estará avisado. Cualquier cosa, llámame. {agente}",
      "tipo": "compraventa"
    },
    {
      "id": "banco-tasacion-fein",
      "para": "banco",
      "titulo": "Seguimiento de tasación y FEIN",
      "texto": "Buenos días, soy {agente}, de Asesoría Castresana. Os escribo por la hipoteca de {comprador} para {inmueble}. ¿Cómo va la tasación? ¿Tenéis fecha prevista para emitir la FEIN? La idea es firmar el {fecha}, así que necesitaríamos la FEIN con al menos 10 días naturales de margen. Muchas gracias.",
      "tipo": "compraventa"
    },
    {
      "id": "notaria-cita",
      "para": "notaria",
      "titulo": "Pedir cita en notaría",
      "texto": "Buenos días, soy {agente}, de Asesoría Castresana. Queríamos pedir cita para la compraventa de {inmueble} entre {vendedor} y {comprador}. Nos vendría bien el {fecha} a las {hora}. ¿Tienen disponibilidad? Les confirmo si hay hipoteca. Gracias.",
      "tipo": "compraventa"
    },
    {
      "id": "notaria-documentacion",
      "para": "notaria",
      "titulo": "Enviar documentación a la notaría",
      "texto": "Buenos días, les adjunto la documentación para la compraventa de {inmueble} ({fecha}, {hora}): DNI/NIE de las partes, nota simple, escritura anterior, recibo del IBI, certificado de la comunidad, certificado energético y contrato de arras. Quedo a la espera del borrador de la escritura. Un saludo, {agente}.",
      "tipo": "compraventa"
    },
    {
      "id": "propietario-alquiler",
      "para": "propietario",
      "titulo": "Pedir papeles al propietario (alquiler)",
      "texto": "Hola {vendedor}, para preparar el alquiler de {inmueble} necesito el certificado energético en vigor, la cédula de habitabilidad (si la tienes) y una copia de la escritura o nota simple. Firmamos el {fecha} a las {hora}. {agente}",
      "tipo": "alquiler"
    },
    {
      "id": "inquilino-firma",
      "para": "inquilino",
      "titulo": "Confirmar firma del alquiler",
      "texto": "Hola {comprador}, te confirmo la firma del alquiler de {inmueble}: {fecha} a las {hora}. Trae DNI/NIE y la fianza (una mensualidad). Te entregaremos las llaves y la copia del certificado energético. {agente}",
      "tipo": "alquiler"
    }
  ]
};

/* Textos de partida de la hoja de visita. Son un BORRADOR: Pau debe
   revisarlos con su gestor o abogado y completar los datos entre corchetes
   (razón social, NIF, dirección, correo) en Ajustes. */
export const HOJA_VISITA_BORRADOR = {
  "declaracion": "D./D.ª {visitante}, con DNI/NIE {dni}, declara que el día {fecha} a las {hora} ha visitado el inmueble {inmueble} acompañado/a por {agente}, de {empresa}, que le ha dado a conocer dicho inmueble.",
  "rgpd": "Responsable: [razón social y NIF de Asesoría Castresana], [dirección], [correo]. Finalidad: dejar constancia de la visita y hacer el seguimiento de su interés por este u otros inmuebles. Base jurídica: medidas precontractuales a petición suya (art. 6.1.b RGPD) y, si marca la casilla, su consentimiento para recibir otras ofertas. Destinatarios: no se ceden datos a terceros salvo obligación legal. Conservación: mientras dure la gestión y después durante los plazos legales. Derechos: acceso, rectificación, supresión, oposición, limitación y portabilidad escribiendo a [correo]; puede reclamar ante la Agencia Española de Protección de Datos (aepd.es). Más información: [enlace a la política de privacidad]."
};

/* Textos de partida de la hoja de captación, preparados por NURIA
   (septiembre de 2026). BORRADOR: Pau debe revisarlos con su gestor o
   abogado y completar los [corchetes]. El desistimiento (14 días
   naturales, TRLGDCU art. 102 y ss.) solo se imprime si el encargo se
   firma fuera de la oficina. Registro de agentes de Asturias: SIN
   VERIFICAR (ver FUENTES-OPERACIONES.md). */
export const HOJA_CAPTACION_BORRADOR = {
  "conformidad": "D./D.ª {propietario}, con DNI/NIE {dni}, declara: 1) Que es titular del inmueble {inmueble} o que actúa con autorización de todos sus titulares. 2) Que ha revisado los datos del inmueble que figuran en esta hoja y que son correctos. 3) Que encarga a {empresa}, representada en este acto por {agente}, la comercialización del inmueble en estas condiciones: tipo de encargo: {tipoEncargo}; honorarios: {honorarios}; duración: {duracion}. 4) Que recibe una copia de esta hoja. Fecha: {fecha}.",
  "rgpd": "Responsable: [razón social], NIF [NIF], [dirección], [correo de contacto]. [Delegado de protección de datos: solo si lo hay.] Finalidades y base jurídica: gestionar el encargo de comercialización de su inmueble y la operación que resulte (ejecución del contrato, art. 6.1.b RGPD); cumplir las obligaciones legales de la agencia, como identificarle y conservar esa documentación según la Ley 10/2010 de prevención del blanqueo de capitales, y las obligaciones fiscales y contables (art. 6.1.c RGPD); y, solo si marca la casilla, enviarle información sobre otros servicios de la agencia (consentimiento, art. 6.1.a RGPD), que puede retirar cuando quiera. Destinatarios: notaría, Registro de la Propiedad, gestoría y entidades que intervengan en la operación cuando sea necesario para cerrarla, y Administraciones públicas cuando lo exija la ley. A las personas interesadas en comprar o alquilar se les facilita la identidad del vendedor o arrendador cuando la pidan antes de formalizar la operación (Ley 12/2023, art. 31). Sus datos de contacto no se publican en ningún anuncio. [Proveedores tecnológicos que tratan datos por cuenta de la agencia: indicar si los hay.] Transferencias internacionales: [no se prevén / indicar]. Conservación: mientras dure el encargo y, después, bloqueados durante los plazos legales (en general 5 años para acciones derivadas del contrato y 10 años para la documentación de identificación exigida por la Ley 10/2010). Sus datos identificativos son necesarios para formalizar el encargo y cumplir la Ley 10/2010; sin ellos no es posible aceptarlo. No se toman decisiones automatizadas ni se elaboran perfiles. Derechos: acceso, rectificación, supresión, oposición, limitación y portabilidad escribiendo a [correo]; puede reclamar ante la Agencia Española de Protección de Datos (www.aepd.es). Más información: [enlace a la política de privacidad].",
  "desistimiento": "Derecho de desistimiento: al haberse firmado este encargo fuera del establecimiento de {empresa}, puede desistir de él en un plazo de 14 días naturales desde hoy, sin indicar el motivo y sin ningún coste, comunicándolo por cualquier medio a [correo] o [dirección]. Se le entrega el formulario de desistimiento."
};
