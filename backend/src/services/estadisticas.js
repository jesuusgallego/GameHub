// Estadísticas de la biblioteca de un usuario: las usa su propio perfil (GET /profile/stats)
// y el perfil público que ven los demás (GET /users/:username).
const pool = require('../config/db');

async function estadisticasDe(userId) {
  // Un solo recorrido de la tabla: COUNT(*) FILTER (WHERE ...) cuenta solo las
  // filas que cumplen la condición. AVG ignora los NULL (juegos sin nota).
  // Los COUNT llegan como bigint y pg los entrega como texto, por eso ::int.
  const resumen = await pool.query(
    `SELECT COUNT(*)::int AS total,
            COUNT(*) FILTER (WHERE status = 'jugando')::int AS jugando,
            COUNT(*) FILTER (WHERE status = 'completado')::int AS completado,
            COUNT(*) FILTER (WHERE status = 'abandonado')::int AS abandonado,
            COUNT(*) FILTER (WHERE status = 'pendiente')::int AS pendiente,
            COUNT(rating)::int AS valorados,
            ROUND(AVG(rating), 1)::float AS nota_media
     FROM user_games
     WHERE user_id = $1`,
    [userId]
  );

  const mejores = await pool.query(
    `SELECT id, igdb_id, name, cover_url, rating
     FROM user_games
     WHERE user_id = $1 AND rating IS NOT NULL
     ORDER BY rating DESC, updated_at DESC
     LIMIT 5`,
    [userId]
  );

  return { stats: resumen.rows[0], mejores: mejores.rows };
}

module.exports = { estadisticasDe };
