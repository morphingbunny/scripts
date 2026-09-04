"use strict";

(self.webpackChunkStylus = self.webpackChunkStylus || []).push([ [ "sidepanel" ], {
  9816(_, es, ls) {
    ls(9073);
    var ts = ls(4429);
    const id = +ls(6940).urlParams.get("id");
    id && (0, ts.default)(id).then(close);
  }
}, _ => {
  _.O(0, [ "color" ], () => _(_.s = 9816));
  _.O();
} ]);