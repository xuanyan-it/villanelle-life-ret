import { Divider, Flex, Typography } from "antd";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import Logo from "../Logo";
import NewRecord from "../NewRecord";
import QueuePopover from "../QueuePopover";
import Settings from "../Settings";
import styles from "./header.module.css";
const Header = () => {
  const { t, i18n } = useTranslation();
  const titleAreaRef = useRef<HTMLDivElement | null>(null);
  const titleWrapRef = useRef<HTMLDivElement | null>(null);
  const titleMeasureRef = useRef<HTMLHeadingElement | null>(null);
  const logoMeasureRef = useRef<HTMLDivElement | null>(null);
  const [showLogo, setShowLogo] = useState(true);
  const [useShortTitle, setUseShortTitle] = useState(false);
  const logoTitleGap = 12;
  const recalcTitle = () => {
    const titleArea = titleAreaRef.current;
    const measure = titleMeasureRef.current;
    const logoMeasure = logoMeasureRef.current;
    if (!titleArea || !measure || !logoMeasure) {
      return;
    }
    const titleAreaWidth = titleArea.clientWidth;
    const logoWidth = logoMeasure.scrollWidth;
    const availableWithLogo = titleAreaWidth - logoWidth - logoTitleGap;
    const requiredLong = measure.scrollWidth;
    const canShowLongWithLogo = requiredLong <= availableWithLogo;
    setShowLogo(canShowLongWithLogo);
    setUseShortTitle(!canShowLongWithLogo);
  };
  useEffect(() => {
    recalcTitle();
  }, [i18n.language]);
  useEffect(() => {
    const area = titleAreaRef.current;
    if (!area || typeof ResizeObserver === "undefined") {
      return;
    }
    const observer = new ResizeObserver(() => {
      recalcTitle();
    });
    observer.observe(area);
    return () => {
      observer.disconnect();
    };
  }, []);
  return (
    <Flex className={styles.header} justify="space-between" align="center">
      <Flex align="center" className={styles.titleArea} ref={titleAreaRef}>
        {showLogo && <Logo />}
        <div className={styles.titleWrap} ref={titleWrapRef}>
          <Typography.Title ellipsis={{ rows: 1 }}>
            
            {useShortTitle
              ? t("header_formal_title_short")
              : t("header_formal_title_long")}
          </Typography.Title>
          <Typography.Title
            ref={titleMeasureRef}
            className={styles.titleMeasure}
            aria-hidden
          >
            {t("header_formal_title_long")}
          </Typography.Title>
          <div ref={logoMeasureRef} className={styles.logoMeasure}>
            <Logo />
          </div>
        </div>
      </Flex>
      <Flex align="center">
        <NewRecord />
        <Divider type="vertical" style={{ marginLeft: 24 }} />
        <QueuePopover />
        <Divider type="vertical" style={{ marginLeft: 24 }} />
        
        <Settings />
      </Flex>
    </Flex>
  );
};
export default Header;
