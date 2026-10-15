// Trozos de SQL que se repiten en las consultas sociales. Son funciones que devuelven texto
// porque lo que cambia es de dónde sale el id de la persona: un parámetro ($1) o la columna
// de otra tabla de la consulta (u.id).

// Los ids de los amigos de una persona. `idSql` es el id: '$1', 'u.id'...
// Una amistad es una fila de friendships con status 'aceptada', y la persona puede estar
// en cualquiera de los dos lados (requester o addressee): el CASE se queda con el otro.
function amigosDe(idSql) {
  return `SELECT CASE WHEN fa.requester_id = ${idSql} THEN fa.addressee_id ELSE fa.requester_id END
            FROM friendships fa
           WHERE fa.status = 'aceptada'
             AND (fa.requester_id = ${idSql} OR fa.addressee_id = ${idSql})`;
}

// Verdadero si las dos personas tienen algún amigo en común
function hayAmigosEnComun(yoSql, otroSql) {
  return `EXISTS (SELECT 1 FROM (${amigosDe(yoSql)}) AS mis(id)
                   WHERE mis.id IN (${amigosDe(otroSql)}))`;
}

// Cuántos amigos en común hay, contando solo a los que no esconden su lista de amigos. Si
// un amigo mío tiene la lista en "nadie", no quiero que su amistad con otra persona se
// deduzca de que aparezca como "amigo en común".
function amigosEnComun(yoSql, otroSql) {
  return `(SELECT COUNT(*)::int FROM users cm
            WHERE cm.id IN (${amigosDe(yoSql)}) AND cm.id IN (${amigosDe(otroSql)})
              AND cm.visibility_friends <> 'nadie')`;
}

// Si `otroSql` me deja enviarle una solicitud según su ajuste request_policy
function puedeSolicitar(yoSql, otroSql, politicaSql) {
  return `(CASE ${politicaSql}
             WHEN 'todos' THEN TRUE
             WHEN 'amigos_de_amigos' THEN ${hayAmigosEnComun(yoSql, otroSql)}
             ELSE FALSE
           END)`;
}

// Excluye a quienes no pueden aparecerle a `yoSql`: los que le han bloqueado y a los que él
// ha bloqueado (esos están en su lista de bloqueados). La tabla de personas de la consulta
// tiene que llamarse u.
function sinBloqueos(yoSql) {
  return `NOT EXISTS (
            SELECT 1 FROM blocks bl
             WHERE (bl.blocker_id = u.id AND bl.blocked_id = ${yoSql})
                OR (bl.blocker_id = ${yoSql} AND bl.blocked_id = u.id)
          )`;
}

module.exports = { amigosDe, hayAmigosEnComun, amigosEnComun, puedeSolicitar, sinBloqueos };
