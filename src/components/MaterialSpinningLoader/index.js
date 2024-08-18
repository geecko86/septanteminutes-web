

import React from "react";
import styles from "./loading-anim.module.css";

const Loader = (props) => {
    const { huge, white } = props;
    return (<svg className={`${styles.spinner} ${huge ? styles.huge : ""}`} viewBox="0 0 66 66" xmlns="http://www.w3.org/2000/svg">
        <circle className={`${white ? styles.white : ""} ${styles.path}`} fill="none" strokeWidth="6" strokeLinecap="round" cx="33" cy="33" r="30"></circle>
    </svg>);
};

export default Loader;