import React, { useEffect } from 'react';
import Image from 'next/image';

import styles from './faq.module.css';
import Head from 'next/head';

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
            <Head>
                <title>FAQ - Septante Minutes Avec</title>
                <meta name="description" content="FAQ de l'émission Septante Minutes Avec" />
                <meta property="og:title" content="FAQ - Septante Minutes Avec" />
                <meta property="og:description" content="FAQ de l'émission Septante Minutes Avec" />
                <meta property="og:image" content="/img/SMA_sleeve_256.webp" />
                <meta property="og:url" content="https://www.septanteminutes.be/faq" />
                <meta property="og:type" content="website" />
                <meta name="twitter:card" content="summary_large_image" />
                <meta name="twitter:title" content="FAQ - Septante Minutes Avec" />
                <meta name="twitter:description" content="FAQ de l'émission Septante Minutes Avec" />
                <meta name="twitter:image" content="https://www.septanteminutes.be/faq" />
                <link href="https://fonts.cdnfonts.com/css/typewriter-inked" rel="stylesheet" />
            </Head>
            <div className={[styles.paper, styles.faqContents].join(" ")}>
                <div className={styles.faqTitle}>
                    <h1>FAQ</h1>
                </div>
                <h2 className={styles.question}>{"Qu'est-ce que \"Septante Minutes Avec\" ?"}</h2>
                <span className={styles.answer}>{"Septante Minutes Avec est un podcast belge proposant des interviews approfondies sur des sujets sociaux, culturels et politiques. Les personnalités invitées peuvent être issues des sphères académiques, politiques, militantes ou simplement les porte-voix d'une cause. Pami les thématiques abordées, on retrouve la politique belge et internationale, la santé mentale, le journalisme, le féminisme, la neurodiversité, et bien plus encore."}</span>
                
                <h2 className={styles.question}>{"Qui est derrière ce projet ?"}</h2>
                <span className={styles.answer}>{"Guillaume Hachez (1994) est un journaliste belge, animateur de Septante Minutes Avec. Il n'est cependant pas journaliste professionnel et ce podcast reste pour lui un hobby."}</span>
                
                <h2 className={styles.question}>{"Depuis combien de temps le podcast existe-t-il ? Comment cela a-t-il commencé ?"}</h2>
                <span className={styles.answer}>{"Le podcast a été lancé en 2018, dans le contexte d'un travail de recherche sur la très faible présence des femmes dans les études tech en Belgique : "}<a href="https://medium.com/@geecko86/des-souris-et-que-des-hommes-c5f533ea66dd">{"\"Des souris et que des hommes\""}</a>. {"Au cours de ce travail, une des expertes qu'il a rencontrées lui a simplement demandé pourquoi il ne poserait pas toutes ces questions à une autorité en la matière : le ministre de l'agenda numérique, Alexander De Croo. Deux micros et un enregistreur Zoom H4 prêtés par la formidable Fanny Ruwet - et l'aventure était lancée."}</span>
                
                <h2 className={styles.question}>{"Comment puis-je écouter le podcast ?"}</h2>
                <span className={styles.answer}>{"Le podcast est disponible sur toutes les plateformes de podcasts. "}<a href="https://bit.ly/SeptanteMinutesSP">Spotify</a>, <a href="https://bit.ly/SeptanteMinutesIT">Apple Podcasts</a> sont les plus connues. Il est aussi disponible sur <a href="https://www.youtube.com/@septanteminutes/videos">YouTube</a>, ou sur ce site web.</span>
                
                <h2 className={styles.question}>{"Est-ce que c'est le travail d'une seule personne ?"}</h2>
                <span className={styles.answer}>{"Pour l'essentiel, oui. Depuis quelques temps le podcast est monté et mixé par l'excellent "}<a href="http://www.xyzebres.be/">Maxime Wathieu</a>.</span>
                
                <h2 className={styles.question}>{"À quelle fréquence sortent les nouveaux épisodes ?"}</h2>
                <span className={styles.answer}>En principe, un jeudi sur deux en dehors des vacances estivales. Dans les faits, des imprévus peuvent arriver.</span>

                <h2 className={styles.question}>{"Puis-je utiliser des extraits de l'émission ?"}</h2>
                <span className={styles.answer}>{"Oui, mais vous devez mentionner la source. Tous les épisodes de Septante Minutes Avec sont disponibles sous license Creative Commons "}<a href="https://creativecommons.org/licenses/by/4.0/deed.fr">CC-BY</a>{". Les utilisations commerciales sont autorisées."}</span>
                
                <h2 className={styles.question}>{"Comment puis-je soutenir le podcast ?"}</h2>
                <span className={styles.answer}>{"Septante Minutes Avec restera toujours gratuit. Le meilleur moyen de soutenir le podcast est d'en parler autour de vous !"}</span>

                <h2 className={styles.question}>{"Comment puis-je contacter Guillaume ?"}</h2>
                <span className={styles.answer}>{""}<a href="mailTo:contact@septanteminutes.be">contact@septanteminutes.be</a></span>

                <h2 className={styles.question}>{"Puis-je proposer un invité ou un sujet pour un futur épisode ?"}</h2>
                <span className={styles.answer}>{"Oui ! Toute suggestion est la bienvenue."}</span>

                <h2 className={styles.question}>{"Où puis-je trouver les notes ou les ressources accompagnants chaque interview ?"}</h2>
                <span className={styles.answer}>{"Que vous utilisiez une plateforme de podcasts, YouTube ou bien ce site web pour écouter Septante Minutes Avec, une description accompagne chaque épisode et vous propose ces informations."}</span>

                <h2 className={styles.question}>{"Le podcast est-il disponible en transcription ou en vidéo ?"}</h2>
                <span className={styles.answer}>{"Malheureusement par manque de ressources, ce n'est pas encore le cas. Depuis 2022, toutes les interviews sont filmées en intégralité afin de produire une capsule pour les réseeaux sociaux et les enregistrements sont ensuite précieusement conservés. Un montage vidéo ou une retranscription intégrale demanderaient cependant énormément de temps. N'hésitez pas à signaler votre intérêt le cas échéant."}</span>
                
                <h2 className={styles.question}>{"Qui a réalisé ce site web ?"}</h2>
                <span className={styles.answer}>{"Le site a été codé entièrement par Guillaume Hachez sur base du fabuleux design de "}<a href="https://www.jnkk.design">Jerry Nkumu</a>.</span>
            </div>
        </>
    )
};

export default FAQPage;