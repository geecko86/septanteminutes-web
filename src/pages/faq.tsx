import React, { useEffect } from 'react';
import Image from 'next/image';

import styles from './faq.module.css';

const FAQPage = (props: { onReady: () => void }) => {

    useEffect(() => {
        props.onReady();
    });

    return (
        <div className={styles.faq}>
            <div className={styles.FAQ_background}>
            </div>
            <PaperSheet />
        </div>
    );
};

const PaperSheet = () => {
    return (
        <>
            <div className={styles.paper} style={{
                height: "100%"
            }}>
                <Image src="https://uploads-ssl.webflow.com/5f2429f172d117fcee10e819/614f353f1e11a6a7afdd8b74_6059a3e2b9ae6d2bd508685c_pt-texture-2.jpg" fill alt="" />
                <div className={styles.faqTitle}>
                    <h1>FAQ</h1>
                </div>
            </div>
            <div className={[styles.paper, styles.faqContents].join(" ")}>
                <h2 className={styles.question}>{"Qu'est-ce que \"Septante Minutes Avec\" ?"}</h2>
                <span className={styles.answer}>{"Septante Minutes Avec est un podcast belge couvrant les sujets de société et la politique au sens large."}</span>
                
                <h2 className={styles.question}>{"Qui est Guillaume Hachez ?"}</h2>
                <span className={styles.answer}>{"Guillaume Hachez (1994) est un journaliste belge, animateur de Septante Minutes Avec. Il n'est cependant pas journaliste professionnel et ce podcast reste un hobby."}</span>
                
                <h2 className={styles.question}>{"Depuis combien de temps est-ce que le podcast existe ? Comment est-ce que ça a commencé ?"}</h2>
                <span className={styles.answer}>{"Le podcast a été lancé en 2018, dans le contexte d'un travail de recherche sur la très faible présence des femmes dans les études tech en Belgique : "}<a href="https://medium.com/@geecko86/des-souris-et-que-des-hommes-c5f533ea66dd">{"\"Des souris et que des hommes\""}.</a>.</span>
                
                <h2 className={styles.question}>{"Comment puis-je écouter le podcast ?"}</h2>
                <span className={styles.answer}>{"Le podcast est disponible sur toutes les plateformes de streaming audio."}</span>
                
                <h2 className={styles.question}>{"Est-ce que c'est le travail d'une seule personne ?"}</h2>
                <span className={styles.answer}>{"Oui. Depuis quelques temps le podcast est monté et mixé par l'excellent "}<a href="http://www.xyzebres.be/">Maxime Wathieu</a>.</span>
                
                <h2 className={styles.question}>{"Comment puis-je soutenir le podcast ?"}</h2>
                <span className={styles.answer}>{"Septante Minutes Avec restera toujours gratuit. La meilleure moyen de soutenir le podcast est d'en parler autour de vous !."}</span>
                
                <h2 className={styles.question}>{"Comment puis-je proposer un sujet d'émission ou une personnalité à inviter ?"}</h2>
                <span className={styles.answer}>{"Vous pouvez envoyer un mail à cette adresse : "}<a href="mailTo:contact@septanteminutes.be">contact@septanteminutes.be</a>.</span>
                
                <h2 className={styles.question}>{"Qui a fait ce site web ?"}</h2>
                <span className={styles.answer}>{"Le site a été codé par Guillaume Hachez sur base du fabuleux design de Jerry Nkumu."}</span>
            </div>
        </>
    )
};

export default FAQPage;