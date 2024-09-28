import React, { useEffect, useState } from "react";
import Head from "next/head";
import { useRouter } from "next/router";

import { Spotlight } from "../components/Spotlight";
import styles from "./404.module.css"
import Link from "next/link";

export default function Custom404(props: { offline ?: boolean, errorCode ?: number, error ?: Error }) {
    const router = useRouter();
    const [visible, setVisible] = useState(true);
    const [isOnline, setIsOnline] = useState(!(props.offline));
    const [randomName, setRandomName] = useState(firstNames[0]);

    const errorCode = `${props.errorCode || 404}`;
    
    useEffect(() => {
        setIsOnline(navigator.onLine && !(props.offline));
        
        const onlineCallback = () => setIsOnline(true && !(props.offline));
        const offlineCallback = () => setIsOnline(false);

        window.addEventListener("online", onlineCallback);
        window.addEventListener("offline", offlineCallback);

        setRandomName(firstNames[Math.floor(Math.random() * firstNames.length)]);

        return () => {
            window.removeEventListener("online", onlineCallback);
            window.removeEventListener("offline", offlineCallback);
        };
    }, [props.offline]);

    useEffect(() => {
        const main = document.querySelector('main');
        const context = document.querySelector('canvas')?.getContext('2d');
        if (main && context) {
            import("../utils/tv").then((module) => {
                const toggleTV = module.default;
                toggleTV(visible, main!!, context!!, styles.on, styles.off);
            });
        }
    }, [visible]);

    const leaving = () => {
        setVisible(false);
        setTimeout(() => {
            router.push("/")
        }, 800);
    };

    if (props.error) console.error(props.error)

    return (
        <div className={styles.container} style={{
            opacity: visible ? 1 : 0,
            transition: "opacity 0.15s ease-in-out 0.6s"
        }}>
            <Head>
                <title>{isOnline ? `${errorCode} - Septante Minutes Avec Personne` : "Septante Minutes sans internet"}</title>
            </Head>
            <main className={["scanlines", styles.scanlines].join(" ")}>
                <div className={["screen", styles.screen].join(" ")}>
                    <canvas id="canvas" className={["picture", styles.picture].join(" ")}></canvas>
                    <div className={["overlay", styles.overlay].join(" ")} />
                    <div className={styles.textContainer}>
                        <h1>
                            {isOnline ? errorCode : "Offline"}
                        </h1>
                        {isOnline && errorCode === "404" ? <p>
                            Oei ! On dirait bien que le lien qu&apos;on vous a donné ne fonctionne pas.<br />
                            Désolé, l&apos;épisode secret avec {randomName} n&apos;est pas ici.<br /><br />
                            <u onClick={leaving}><Link href="/">SeptanteMinutes.be</Link></u>
                            <br />
                        </p> : !isOnline ? (<p style={{textAlign: "justify"}}>
                            {`Hors-ligne (adj.) : Désigne un appareil, un système ou une personne qui n'est pas connectée à Internet. Par exemple : vous.`}
                            <br/><br/>
                            <u onClick={leaving}><Link href="mailto:contact@septanteminutes.be">contact@SeptanteMinutes.be</Link></u>
                            <br />
                        </p>) : (<p style={{textAlign: "justify"}}>
                            {`Une erreur est survenue. Ce n'est pas normal. Mais c'est pas grave, on va s'en sortir ensemble. Vous pouvez nous contacter à l'adresse ci-dessous :`}
                            <br/><br/>
                            <u onClick={leaving}><Link href="mailto:contact@septanteminutes.be">contact@SeptanteMinutes.be</Link></u>
                            {/* { props.error ? <><br/><br/><i>{props.error.toString()}</i></> : null } */}
                            <br />
                        </p>)}
                    </div>
                    <Spotlight className={styles.spotlight} fill="white" />
                </div>
            </main>
        </div>
    )
}

const firstNames = [
    "Stromae",
    "Angèle",
    "Jean-Claude Van Damme",
    "Philippe de Belgique",
    "Cécile de France",
    "Axelle Red",
    "Matthias Schoenaerts",
    "Mathilde d'Udekem d'Acoz",
    "Benoît Poelvoorde",
    "Virginie Efira"
];