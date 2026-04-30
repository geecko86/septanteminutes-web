// Stub for scroll-snap used during server-side (Node.js) compilation.
// scroll-snap's UMD bundle references `self`/`this` as a global at the top
// of its IIFE, which throws in strict-mode Node.js where `this` is undefined.
// The real library is only needed in the browser (inside a useEffect), so on
// the server we export a no-op factory that returns the same { bind, unbind }
// shape — the component never calls it outside useEffect, so this is safe.
module.exports = function createScrollSnap() {
  return { bind: function() {}, unbind: function() {} };
};
