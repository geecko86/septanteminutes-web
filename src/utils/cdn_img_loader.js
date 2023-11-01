'use client'
 
export default function loader({ src, width, quality }) {
    if (src.includes("cloudinary"))
        return src.replace("http://", "https://").replace("/upload/", `/upload/c_scale,w_${width},f_webp,q_${quality || 100}/`);
    else if (src.includes("framerusercontent.com"))
        return src.replace("http://", "https://").replace("/assets/", "/images/").replace(/(\.[a-z]{1,4})$/, `$1?scale-down-to=${width}&q=${quality || 75}`);
    else return src;
}