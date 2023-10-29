'use client'
 
export default function loader({ src, width, quality }) {
    return src.replace("http://", "https://").replace("/upload/", `/upload/c_scale,w_${width},f_webp,q_${quality || 75}/`);
}

export const blur = (src) => src.replace("/upload/", "/upload/c_scale,w_64,f_webp,q_50/");