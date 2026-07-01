import { parseCurrencyCRC, formatColones, calcularTotalCita } from '../lib/utils';

// Mock data representing services from database
const ServicioA = { id: 'srv-a', nombre: 'Servicio A', precio: 5000 };
const ServicioB = { id: 'srv-b', nombre: 'Servicio B', precio: 3000 };
const ServicioC = { id: 'srv-c', nombre: 'Servicio C', precio: 7500 };

function runTests() {
  console.log('=== INICIANDO PRUEBAS DE VALIDACIÓN ===\n');

  // Caso 1:
  // Servicio A = ₡5,000
  // Seleccionar solo Servicio A
  // Resultado esperado: ₡5,000
  console.log('Caso 1: Seleccionar solo Servicio A');
  const seleccion1 = [ServicioA];
  const total1 = calcularTotalCita(seleccion1);
  const totalFmt1 = formatColones(total1);
  console.log(`  Total numérico: ${total1}`);
  console.log(`  Resultado formateado: ${totalFmt1}`);
  console.assert(totalFmt1 === '₡5,000', `Fallo Caso 1: esperado ₡5,000, obtenido ${totalFmt1}`);

  // Caso 2:
  // Servicio A = ₡5,000
  // Servicio B = ₡3,000
  // Resultado esperado: ₡8,000
  console.log('\nCaso 2: Seleccionar Servicio A y Servicio B');
  const seleccion2 = [ServicioA, ServicioB];
  const total2 = calcularTotalCita(seleccion2);
  const totalFmt2 = formatColones(total2);
  console.log(`  Total numérico: ${total2}`);
  console.log(`  Resultado formateado: ${totalFmt2}`);
  console.assert(totalFmt2 === '₡8,000', `Fallo Caso 2: esperado ₡8,000, obtenido ${totalFmt2}`);

  // Caso 3:
  // Servicio A = ₡5,000
  // Servicio B = ₡3,000
  // Servicio C = ₡7,500
  // Resultado esperado: ₡15,500
  console.log('\nCaso 3: Seleccionar Servicio A, B y C');
  const seleccion3 = [ServicioA, ServicioB, ServicioC];
  const total3 = calcularTotalCita(seleccion3);
  const totalFmt3 = formatColones(total3);
  console.log(`  Total numérico: ${total3}`);
  console.log(`  Resultado formateado: ${totalFmt3}`);
  console.assert(totalFmt3 === '₡15,500', `Fallo Caso 3: esperado ₡15,500, obtenido ${totalFmt3}`);

  // Caso 4:
  // Seleccionar Servicio A y B, luego quitar Servicio B.
  // Resultado esperado: solo debe quedar ₡5,000
  console.log('\nCaso 4: Seleccionar A y B, luego quitar B');
  let seleccion4 = [ServicioA, ServicioB];
  // Simulando eliminación en frontend por index
  seleccion4 = seleccion4.filter((_, idx) => idx !== 1); // Quitar B (index 1)
  const total4 = calcularTotalCita(seleccion4);
  const totalFmt4 = formatColones(total4);
  console.log(`  Total numérico: ${total4}`);
  console.log(`  Resultado formateado: ${totalFmt4}`);
  console.assert(totalFmt4 === '₡5,000', `Fallo Caso 4: esperado ₡5,000, obtenido ${totalFmt4}`);

  // Caso 5:
  // Caso de conversión de tipos de datos complejos (Decimal, strings con comas y símbolos)
  console.log('\nPrueba extra: Conversión segura de strings con formato y objetos Decimal');
  const decimalLike = { toNumber: () => 12500.45 };
  const formattedString1 = '₡15,500';
  const formattedString2 = '₡10,000.00';
  
  const p1 = parseCurrencyCRC(decimalLike); // 12500
  const p2 = parseCurrencyCRC(formattedString1); // 15500
  const p3 = parseCurrencyCRC(formattedString2); // 10000

  console.log(`  Decimal object (12500.45) -> ${p1} (esperado: 12500)`);
  console.log(`  String "₡15,500" -> ${p2} (esperado: 15500)`);
  console.log(`  String "₡10,000.00" -> ${p3} (esperado: 10000)`);

  console.assert(p1 === 12500, `Extra 1 falló`);
  console.assert(p2 === 15500, `Extra 2 falló`);
  console.assert(p3 === 10000, `Extra 3 falló`);

  console.log('\n=== TODAS LAS PRUEBAS COMPLETADAS CON ÉXITO ===');
}

runTests();
