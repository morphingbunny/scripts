-- Generado por k4 · módulo HyprTheme.
-- No lo edites a mano: se reescribe cada vez que guardas desde la barra.
-- Para revertirlo: borra este archivo y su línea require de hyprland.lua.

hl.config({
    general = {
        gaps_in = 3,
        gaps_out = 8,
        border_size = 2,
        col = {
            active_border = { colors = { "rgba(82dcccff)", "rgba(007d6fff)" }, angle = 45 },
            inactive_border = "rgba(798bb2ff)",
        },
    },
    decoration = {
        rounding = 10,
        active_opacity = 1.00,
        inactive_opacity = 1.00,
        blur = {
            enabled = false,
            size = 5,
            passes = 4,
        },
        shadow = { enabled = false },
    },
})

hl.animation({ leaf = "global", enabled = false, speed = 1, bezier = "quick" })
