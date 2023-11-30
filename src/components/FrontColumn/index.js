import React from "react";
import Image from "next/image";

import styles from "./frontcolumn.module.css";

const FrontColumn = function FrontColumn(props) {
    
    const {
        className,
        pic,
        ratio,
        date,
        subtitle,
        ...otherProps
    } = props;

    return (
        <>
            <div {...otherProps} className={[className, styles.front_column].join(" ")}>
                <div style={{ position: 'absolute', height: '100%', width: '100%' }}>
                    <Image alt="" fill sizes="14875vh/208" src="https://framerusercontent.com/images/O0BnVL6xjWTnfJ2Hot68ihn7Hzo.png" style={{ position: 'absolute', height: '100%', width: '100%', inset: '0px', color: 'transparent', opacity: '0.1' }} />
                    <div style={{ height: '100%', width: '100%', background: 'radial-gradient(circle, rgba(255, 255, 255, 0.2) 0%, rgba(0, 0, 0, 0.2) 60%), linear-gradient(rgba(0, 0, 0, 0.5), rgba(0, 0, 0, 0))' }} />
                </div>
                <div className={styles.photo} data-border="true" style={{ "--borderBottomWidth": '15px', "--borderColor": '#E0E0E0', "--borderLeftWidth": '15px', "--borderRightWidth": '15px', "--borderStyle": 'solid', "--borderTopWidth": '15px', aspectRatio: ratio, filter: 'drop-shadow(rgba(0, 0, 0, 0.1) 0px 6px 1px) drop-shadow(rgba(0, 0, 0, 0.05) 0px 16px 4px)' }}>
                    <Image alt="" sizes="30vw" fill={true} src={pic} style={{ position: 'absolute', height: '100%', width: '100%', inset: '0px', objectFit: 'cover', color: 'transparent', backgroundColor: 'rgb(40, 40, 40)' }} />
                </div>
                <div className={styles.legende}>
                    <div className={styles.subtitle}>
                        <div className={styles.subtitle_text} data-framer-component-type="RichTextContainer" style={{ outline: 'none', display: 'flex', flexDirection: 'column', justifyContent: 'flex-start', flexShrink: 0, "-- extracted1w3ko1f": 'rgba(66, 56, 37, 1)', "--framer-paragraph-spacing": '0px', transform: 'none' }}>
                            <p className="framer-text" style={{ "--framer-font-size": '1.6vh' }}>
                                <span className="framer-text" style={{ "--fontSelector": 'R0Y7RnV0dXJhLTgwMA==', "--framer-font-family": 'Futura', "--framer-font-size": '1.6vh', "--framer-font-weight": 800, "--framer-text-color": 'var(--extracted-1w3ko1f, rgba(66, 56, 37, 1))' }}>{subtitle}</span>
                            </p>
                        </div >
                        <div className={styles.date_text} data-framer-component-type="RichTextContainer" style={{
                            outline: 'none', display: 'flex', flexDirection: 'column', justifyContent: 'flex-start', flexShrink: 0, "-- extracted1w3ko1f": 'rgba(66, 56, 37, 1)', "--framer-paragraph-spacing": '0px', transform: 'none'
                        }}>
                            <p className="framer-text" style={{ "--framer-font-size": '0.8vh' }}>
                                <span className="framer-text" style={{ "--fontSelector": 'R0Y7UmFkd2F2ZS1yZWd1bGFy', "--framer-font-family": '"Radwave Demo"', "--framer-font-size": '0.8vh', "--framer-text-color": 'var(--extracted-1w3ko1f, rgba(66, 56, 37, 1))' }}>{date}</span >
                            </p >
                        </div >
                    </div >
                    <img alt="" src="/img/side_A.svg" />
                    <img alt="" src="/img/45_rpm.svg" />
                    <img alt="" src="/img/stereo.svg" />
                    <img alt="" src="/img/import.svg" />
                    <div className={styles.credits} data-framer-component-type="RichTextContainer" style={{ outline: 'none', display: 'flex', flexDirection: 'column', justifyContent: 'flex-start', flexShrink: 0, "--extracted-1w3ko1f": 'rgba(66, 56, 37, 1)', "--extracted-5dqwso": 'rgba(66, 56, 37, 1)', "--framer-paragraph-spacing": '0px', transform: 'none', opacity: 1 }}>
                        <p className="framer-text" style={{ "--framer-font-size": '0.8vh' }}>
                            <span className="framer-text" style={{ "--fontSelector": 'R0Y7T3N3YWxkLTYwMA==', "--framer-font-family": '"Oswald"', "--framer-font-size": '0.8vh', "--framer-fontWeight": 600, "--framer-text-color": 'var(--extracted-1w3ko1f, rgba(66, 56, 37, 1))', "--framer-text-transform": 'uppercase' }}> Disponible sur toutes</span >
                        </p >
                        <p className="framer-text" style={{ "--framer-font-size": '0.8vh' }}>
                            <span className="framer-text" style={{ "--fontSelector": 'R0Y7T3N3YWxkLTYwMA==', "--framer-font-family": '"Oswald"', "--framer-font-size": '0.8vh', "--framer-fontWeight": 600, "--framer-text-color": 'var(--extracted-5dqwso, rgba(66, 56, 37, 1))', "--framer-text-transform": 'uppercase' }}> les plateformes</span >
                        </p >
                    </div >
                </div >
            </div >
        </>
    );
};

export default FrontColumn;

export const FrontPosters = [
    { img: "https://framerusercontent.com/images/wHRBECARfrBETXB8umbaucNaw.jpg", text: "Victory, Rue Neuve", ratio: 411/471, date: "Bruxelles, 1946-1973" },
    { img: "https://framerusercontent.com/images/aa2lp44awY3eOcQk3nxyPg0kyQ8.jpg", text: "« Rosa danst Rosas »", ratio: 1381/1920, date: "Anne Teresa De Keersmaeker" },
    { img: "https://framerusercontent.com/images/pmK4BAAYF4DgSjpVBMcya9UsBo.jpg", text: "Exposition Universelle", ratio: 573/828, date: "Bruxelles 1958" },
    { img: "https://framerusercontent.com/images/WiTE1wYTrGK2zx2OVVRi5QGnFg.jpg", text: "Walen Buiten", ratio: 2837/4096, date: "Leuven, 1968" }
];