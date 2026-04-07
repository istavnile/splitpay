export function calculateBalance(gastosActivos, participantesIds, perfiles) {
    if (!gastosActivos || gastosActivos.length === 0 || !participantesIds || participantesIds.length === 0) {
        return { resumen: [], transferencias: [], textoExportar: '', totalEvento: 0 };
    }

    let tot = {};
    let tGen = 0;

    // Initialize all participants to 0
    participantesIds.forEach(p => tot[p] = 0);

    // Sum expenses
    gastosActivos.forEach(g => {
        const pagadorId = typeof g.pagado_por === 'object' ? g.pagado_por.id : g.pagado_por;
        if (tot[pagadorId] !== undefined) {
            const amount = Number(g.monto);
            tot[pagadorId] += amount;
            tGen += amount;
        }
    });

    const cuota = tGen / participantesIds.length;

    let saldos = participantesIds.map(p => ({
        id: p,
        nombre: perfiles[p] || 'Usuario',
        saldo: tot[p] - cuota,
        totalPagado: tot[p]
    }));

    // Resumen visual
    let resumen = saldos.map(s => ({
        nombre: s.nombre,
        pagado: s.totalPagado,
        balance: s.saldo
    }));

    // Separar deudores (-) y acreedores (+)
    let deudores = saldos.filter(s => s.saldo < -0.01);
    let acreedores = saldos.filter(s => s.saldo > 0.01);

    let transferencias = [];
    let txt = `📊 BALANCE SPLITPAY\nCuota por persona: ${cuota.toFixed(2)}\nTotal del Evento: ${tGen.toFixed(2)}\n\n`;

    let i = 0, j = 0;
    while (i < deudores.length && j < acreedores.length) {
        let montoTransferir = Math.min(Math.abs(deudores[i].saldo), acreedores[j].saldo);

        transferencias.push({
            de: deudores[i].nombre,
            para: acreedores[j].nombre,
            monto: montoTransferir
        });

        txt += `• ${deudores[i].nombre} -> ${acreedores[j].nombre}: ${montoTransferir.toFixed(2)}\n`;

        deudores[i].saldo += montoTransferir;
        acreedores[j].saldo -= montoTransferir;

        if (Math.abs(deudores[i].saldo) < 0.01) i++;
        if (acreedores[j].saldo < 0.01) j++;
    }

    return {
        resumen,
        transferencias,
        textoExportar: txt,
        totalEvento: tGen
    };
}
