import React from "react";
import { ImageWrapper } from "./ImageBase";

// Tiny 12px WebP placeholder, stripped of the original embedded color profile.
// Keeping it inline makes it available before the full image or its asset chunk.
const blurDataURL = "data:image/webp;base64,UklGRrIAAABXRUJQVlA4WAoAAAAQAAAACwAACwAAQUxQSGIAAAABcFNt27I8v0w2ueCyOoRg9AYEsCgcAvjGIQSbOwX+DKz6vh0iYgIAQO3WZNB653api1Ry/XqvDCq/fb+vVar4fL83acrqLfdDmQLMnALeU8ALMVfkstNJliuEYYEzxyPjD1ZQOCAqAAAAcAEAnQEqDAAMAASAciWMAsOxQAAA/u+D828D/voCs31SOwVm+SZ8AAAA";

const Plant2 = (props) => <ImageWrapper sizes="25vh" blurDataURL={blurDataURL} {...props} priority src="https://framerusercontent.com/images/lFUB6zkoI3fsnsa3UYKcdXQVhE.png" />;
export default Plant2;
