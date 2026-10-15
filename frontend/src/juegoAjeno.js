// Los juegos de otra persona llegan en dos formas: en su biblioteca (GET /users/:u/games,
// con `status`, `rating`... y mi parte en `my_*`) y en la lista de lo que tenemos en común
// (GET /users/:u/common, con `their_*` y `my_*`). La ficha y las listas trabajan con la
// primera; esto convierte la segunda.
export function juegoDeComun(c) {
  return {
    igdb_id: c.igdb_id,
    name: c.name,
    cover_url: c.cover_url,
    status: c.their_status,
    rating: c.their_rating,
    platform: c.their_platform,
    review: c.their_review,
    has_review: c.their_has_review,
    playtime_minutes: c.their_playtime_minutes,
    achievements_unlocked: c.their_achievements_unlocked,
    achievements_total: c.their_achievements_total,
    in_common: true,
    my_status: c.my_status,
    my_rating: c.my_rating,
    my_playtime_minutes: c.my_playtime_minutes,
    my_achievements_unlocked: c.my_achievements_unlocked,
    my_achievements_total: c.my_achievements_total,
  }
}

// Mis datos de Steam de un juego en común, con la forma que espera ProgresoSteam
export function miProgreso(j) {
  return {
    playtime_minutes: j.my_playtime_minutes,
    achievements_unlocked: j.my_achievements_unlocked,
    achievements_total: j.my_achievements_total,
  }
}
