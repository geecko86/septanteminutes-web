import styles from "../components/NotebookOverlay/overlay.module.css";

const enterAnim = [
    [
      `.${styles.openbook}`,
      { y: "-20%", x: "-50%" },
      { type: "spring", stiffness: 400, damping: 30, mass: 1 },
    ],
    [
      `.${styles.openbook}`,
      { y: "-50%", x: "-50%", opacity: 1 },
      { type: "spring", stiffness: 200, damping: 30, mass: 1 },
    ]
  ];
  
  const exitAnim = [
    [
      `.${styles.openbook}`,
      { y: "-50%", x: "-50%", opacity: 1 },
      { type: "spring", stiffness: 400, damping: 30, mass: 1 },
    ],
    [
      `.${styles.openbook}`,
      { y: "0%", x: "-50%", opacity: 0.5 },
      { type: "spring", stiffness: 400, damping: 30, mass: 1 },
    ]
  ];

  export { enterAnim, exitAnim };