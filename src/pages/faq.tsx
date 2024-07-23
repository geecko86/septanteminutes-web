import React, { useEffect, useRef, useCallback, useState } from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';

import styles from './faq.module.css';
import Head from 'next/head';
import Link from 'next/link';
import Image from 'next/image';
import { isMobile } from 'react-device-detect';

const FAQPage = (props: { onReady: () => void }) => {

    const pageRef = useRef<HTMLDivElement>(null);
    const [pageHeight, setPageHeight] = useState(0);
    const [letterReady, setLetterReady] = useState(false);

    const onReady = useCallback((delay: number = 100) => {
        setTimeout(() => {
            setLetterReady(true);
            props.onReady();
        }, delay);
    }, [setLetterReady, props]);

    useEffect(() => {
        setPageHeight(window.innerHeight)
    }, [setPageHeight]);

    useEffect(() => {
        if (isMobile) {
            setLetterReady(true);
            onReady(200);
        }
    }, [setLetterReady, onReady]);

    const { scrollYProgress } = useScroll();
    const yOffset = useTransform(scrollYProgress, [0, 1], [-pageHeight / 6.25, pageHeight / 6.25]);
    const y = useTransform(yOffset, (value) => -Math.floor(value));

    return (
        <div className={styles.faq} ref={pageRef}>
            <motion.div style={{ y: y, scale: 1.5 }}
                className={[styles.FAQ_background, letterReady ? styles.FAQ_background_ready : ""].join(" ")}>
                <Image draggable="false" src="https://framerusercontent.com/images/U96v1PGAZqRKlDY2kIjgaRNkIY.jpg" alt="Background" fill onLoad={() => {
                    setTimeout(() => {
                        onReady();
                    }, 300);
                }} />
            </motion.div>
            <PaperSheet ready={letterReady} />
        </div>
    );
};

const PaperSheet = (props: { ready: boolean }) => {
    const faqRef = useRef<HTMLDivElement>(null);
    const [paperHeight, setPaperHeight] = useState(0);

    const resizeCallback = useCallback(() => {
        if (faqRef.current) {
            setPaperHeight(faqRef.current.clientHeight);
        }
        console.log("d")
    }, [faqRef, setPaperHeight]);

    useEffect(() => {
        window.addEventListener('resize', resizeCallback);
        setTimeout(() => {
            resizeCallback();
        }, 300);
        return () => {
            window.removeEventListener('resize', resizeCallback);
        };
    }, [resizeCallback]);

    useEffect(() => {
        const bottomSpan = getSpanClosestToViewportBottom();
    });

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
            <motion.div className={`${styles.faqContainer} ${props.ready ? styles.faqReady : ""}`} style={{ y: "2.15%" }}>
                <div className={styles.paper} style={{ height: paperHeight }} />
                <div className={[styles.faqContents].join(" ")} ref={faqRef} >
                    <div className={styles.faqTitleBlur}>
                        <div className={styles.faqTitleMask}>
                            <div className={styles.faqTitle}>
                                <h1>FAQ</h1>
                            </div>
                        </div>
                    </div>
                    <Link className={styles.backButton} href="/">
                        {"< Retour"}
                    </Link>
                    <h2 className={styles.question} id="q_0">En quoi consiste «&nbsp;Septante&nbsp;Minutes&nbsp;Avec&nbsp;»&nbsp;?</h2>
                    <span className={styles.answer}>{"Septante Minutes Avec est un podcast belge proposant des interviews approfondies sur des sujets de société, culturels ou politiques. Les personnalités invitées peuvent être issues des sphères académiques, politiques, militantes ou simplement les porte-voix d'une cause. Pami les thématiques abordées, on retrouve la politique belge et internationale, la santé mentale, le journalisme, le féminisme, la neurodiversité, et bien plus encore."}</span>

                    <h2 className={styles.question} id="q_1">{"Qui est derrière ce podcast ?"}</h2>
                    <span className={styles.answer}>{"Guillaume Hachez est un journaliste belge, animateur de Septante Minutes Avec. Il n'est cependant pas journaliste professionnel et vit de son activité de développeur informatique en freelance. Ce podcast reste pour lui un hobby. Autiste et TDAH, il revendique ouvertement sa différence et défend une conscientisation accrue de ces enjeux."}</span>

                    <h2 className={styles.question} id="q_2">{"Quel est le format de l'émission ?"}</h2>
                    <span className={styles.answer}>{"Chaque épisode dure entre 70 et 90 minutes, sans coupure publicitaire. L'émission est enregistrée en une seule prise et puis montée. Les interviews sont le plus souvent enregistrées en personne sur le lieu de travail ou au domicile de l'invité·e. Lorsque c'est nécessaire, elles sont enregistrées à distance. Pour éviter de mettre les invités sous presison, il y a toujours un montage avant la publication."}</span>

                    <h2 className={styles.question} id="q_3">{"Comment sont choisis les invités et les sujets ?"}</h2>
                    <span className={styles.answer}>{"Les invités sont choisis en fonction de leur expertise, de leur parcours, de leur actualité et de leur charisme face à un micro. Si un sujet peut être choisi en fonction de l'actualité, les meilleurs épisodes sont souvent ceux qui éclairent les auditeurs/auditrices sur des sujets connus du grand public, mais néanmoins profondément incompris. Exemple : si tout le monde a entendu parler de la schizophrénie, ou de la notion de virilité, ces sujets sont plus rarement assimilés."}</span>

                    <h2 className={styles.question} id="q_4">{"Depuis combien de temps le podcast existe-t-il ? Comment cela a-t-il commencé ?"}</h2>
                    <span className={styles.answer}>{"Le podcast a été lancé en 2018, dans le contexte d'un travail de recherche sur la très faible présence des femmes dans les études tech en Belgique : "}<a href="https://medium.com/@geecko86/des-souris-et-que-des-hommes-c5f533ea66dd">{"\"Des souris et que des hommes\""}</a>. {"Au cours de ce travail, une des expertes qu'il a rencontrées lui a simplement demandé pourquoi il ne poserait pas toutes ces questions à une autorité en la matière : Alexander De Croo, qui était alors vice-premier ministre et ministre de l'agenda numérique. Deux micros et un enregistreur Zoom H4 prêtés par la formidable Fanny Ruwet - et l'aventure était lancée."}</span>

                    <h2 className={styles.question} id="q_5">{"Comment puis-je écouter le podcast ?"}</h2>
                    <span className={styles.answer}>{"Le podcast est disponible sur toutes les plateformes de podcasts. "}<a href="https://bit.ly/SeptanteMinutesSP">Spotify</a>, <a href="https://bit.ly/SeptanteMinutesIT">Apple Podcasts</a> sont les plus connues. Il est aussi disponible sur <a href="https://www.youtube.com/@septanteminutes/videos">YouTube</a>, ou sur ce site web.</span>

                    <h2 className={styles.question} id="q_6">{"Est-ce que c'est le travail d'une seule personne ?"}</h2>
                    <span className={styles.answer}>{"Pour l'essentiel, oui. Depuis quelques temps le podcast est monté et mixé par l'excellent "}<a href="http://www.xyzebres.be/">Maxime Wathieu</a>.</span>

                    <h2 className={styles.question} id="q_7">{"À quelle fréquence sortent les nouveaux épisodes ?"}</h2>
                    <span className={styles.answer}>En principe, un jeudi sur deux en dehors des vacances estivales. Dans les faits, des imprévus peuvent arriver.</span>

                    <h2 className={styles.question} id="q_8">{"Puis-je utiliser des extraits de l'émission ?"}</h2>
                    <span className={styles.answer}>{"Oui, mais vous devez mentionner la source. Tous les épisodes de Septante Minutes Avec sont disponibles sous license Creative Commons "}<a href="https://creativecommons.org/licenses/by/4.0/deed.fr">CC-BY</a>{". Les utilisations commerciales sont autorisées. ATTENTION : le générique musical est protégé par des droits d'auteur distincts et n'est pas couvert par la licence CC-BY."}</span>

                    <h2 className={styles.question} id="q_9">{"Comment puis-je soutenir le podcast ?"}</h2>
                    <span className={styles.answer}>{"Septante Minutes Avec restera toujours gratuit. Le meilleur moyen de soutenir le podcast est d'en parler autour de vous !"}</span>

                    <h2 className={styles.question} id="q_email">{"Comment puis-je contacter Guillaume ?"}</h2>
                    <span className={styles.answer}>{""}<a href="mailTo:contact@septanteminutes.be">contact@septanteminutes.be</a></span>

                    <h2 className={styles.question} id="q_suggest">{"Puis-je proposer un invité ou un sujet pour un futur épisode ?"}</h2>
                    <span className={styles.answer}>{"Oui ! Toute suggestion est la bienvenue."}</span>

                    <h2 className={styles.question} id="q_desc">{"Où puis-je trouver les notes ou les ressources accompagnant chaque interview ?"}</h2>
                    <span className={styles.answer}>{"Que vous utilisiez une plateforme de podcasts, YouTube ou bien ce site web pour écouter Septante Minutes Avec, une description accompagne chaque épisode et vous propose ces informations ainsi qu'une liste de chapitres."}</span>

                    <h2 className={styles.question} id="q_video">{"Le podcast est-il disponible en transcription ou en vidéo ?"}</h2>
                    <span className={styles.answer}>{"Malheureusement par manque de ressources, ce n'est pas encore le cas. Depuis 2022, toutes les interviews sont filmées en intégralité afin de produire une capsule pour les réseaux sociaux et les enregistrements sont ensuite précieusement conservés. Un montage vidéo ou une retranscription intégrale demanderaient cependant énormément de temps. N'hésitez pas à signaler votre intérêt le cas échéant."}</span>

                    <h2 className={styles.question} id="q_gear">{"Quel est le matériel utilisé pour l'enregistrement et la production ?"}</h2>
                    <span className={styles.answer}>
                        <ul>
                            <li>2 micros Shure SM7B avec pré-amplis FetHead</li>
                            <li>1 enregistreur Zoom H6</li>
                            <li>2 caméras BlackMagic Pocket Cinema 4K, objectifs à focale fixe 25mm F1.7</li>
                            <li>Davinci Resolve Studio 19, Dehancer OFX pour la production vidéo</li>
                            <li>Abbey Road Plugins - Waves Audio</li>
                        </ul>
                    </span>

                    <h2 className={styles.question} id="q_ai">{"Certaines descriptions d'épisodes indiquent avoir été générées par intelligence artificielle. Est-ce vrai ?"}</h2>
                    <span className={styles.answer}>{"Oui. Avant chaque publication, l'interview est écoutée en intégralité par un outil qui, en s'appuyant sur les API de ChatGPT 4 et d'Assembly AI, génère une description succinte et une liste de chapitres qui est ensuite intégrée dans le fichier mp3."}</span>

                    <h2 className={styles.question} id="q_theme">{"D'où vient le thème musical de l'émission ?"}</h2>
                    <span className={styles.answer}><i>{"\"Rush Hour\""}</i>{", le thème musical de Septante Minutes Avec, est une composition originale de "}<a href="https://www.louisdowdeswell.com/">Louis Dowdeswell</a> (Chief Chops Ltd, London). Il est la propriété exclusive de Guillaume Hachez.</span>

                    <h2 className={styles.question} id="q_logo">{"Qui a réalisé le logo de Septante Minutes Avec ?"}</h2>
                    <span className={styles.answer}>{"L'identité visuelle de Septante Minutes Avec a été réalisée par le très talentueux "}<a href="https://www.jnkk.design">Jerry Nkumu</a>.</span>

                    <h2 className={styles.question} id="q_web">{"Qui a réalisé ce site web ?"}</h2>
                    <span className={styles.answer}>{"Le site a été codé entièrement par Guillaume Hachez sur base du fabuleux design de "}<a href="https://www.jnkk.design">Jerry Nkumu</a>.</span>
                </div>
            </motion.div>
        </>
    )
};

function isInViewport(element: HTMLElement) {
    const rect = element.getBoundingClientRect();
    return (
      rect.top >= 0 &&
      rect.left >= 0 &&
      rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
      rect.right <= (window.innerWidth || document.documentElement.clientWidth)
    );
  }

function getSpanClosestToViewportBottom() {
    const spans = document.querySelectorAll('span');
    let closestSpan = null;
    let closestDistance = Infinity;
  
    spans.forEach(span => {
      if (isInViewport(span)) {
        const distanceToBottom = window.innerHeight - span.getBoundingClientRect().bottom;
        if (distanceToBottom >= 0 && distanceToBottom < closestDistance) {
          closestDistance = distanceToBottom;
          closestSpan = span;
        }
      }
    });
  
    return closestSpan;
  }

export default FAQPage;
