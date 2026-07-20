import { Button, Col, Flex, Popover, Progress, Row, Typography } from "antd";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useDispatch, useSelector } from "react-redux";
import { APP_VERSION } from "../../config/version";
import { useBatchProgress } from "../../hooks/useBatchProgress";
import type { AppDispatch, RootState } from "../../store";
import {
  fetchSampleRecordAsync,
  getCurrentPage,
  getDeletedOnly,
} from "../../store/record";
import styles from "./footer.module.css";
import { api } from "../../api";
import { getInstituteName } from "../../store/user";
const Footer = () => {
  const { t } = useTranslation();
  const dispatch = useDispatch<AppDispatch>();
  const instituteName = useSelector((state: RootState) => getInstituteName(state));
  const {
    totalCount,
    pendingCount,
    completedCount,
    progressPercent,
    isBusy: isQueueBusy,
    isCompleted: isQueueCompleted,
  } = useBatchProgress();
  const currentPage = useSelector((state: RootState) => getCurrentPage(state));
  const deletedOnly = useSelector((state: RootState) =>
    getDeletedOnly(state)
  );
  const [popoverShow, setPopoverShow] = useState<boolean>(false);
  const [isCancelling, setIsCancelling] = useState(false);
  // Keep popover behavior consistent with the existing flow.
  useEffect(() => {
    if (totalCount && totalCount === pendingCount) {
      setPopoverShow(true);
      return;
    }
    if (isQueueCompleted || totalCount === 0) {
      setPopoverShow(false);
    }
  }, [isQueueCompleted, pendingCount, totalCount]);

  // Backend cancel is cooperative; UI should show immediate feedback.
  // Once polling indicates the queue is no longer busy, we reset the local "cancelling" state.
  useEffect(() => {
    if (isCancelling && !isQueueBusy) {
      setIsCancelling(false);
    }
  }, [isCancelling, isQueueBusy]);
  const handleOpenChange = (newOpen: boolean) => {
    setPopoverShow(newOpen);
  };
  const togglePopover = () => {
    setPopoverShow(true);
  };
  const handleFinishAndReload = () => {
    setPopoverShow(false);
    dispatch(fetchSampleRecordAsync({ page: currentPage, deletedOnly }));
  };
  const handleStopTest = async (e) => {
    e.stopPropagation();
    e.preventDefault();
    setIsCancelling(true);
    try {
      const active = await api.activeEvaluationJobs({ instituteName });
      const jobUuid = active.jobs[0]?.jobUuid;
      if (jobUuid) {
        await api.cancelEvaluationJob({ jobUuid });
      }
    } catch {
      // ignore
    }
  };
  return (
    <div className={styles.footer}>
      <Row justify="center" style={{ margin: 4 }}>
        <Col span={8}>
          <Typography.Text
            style={{
              color: "white",
              marginLeft: 10,
              whiteSpace: "nowrap",
            }}
          >
            {t("footer_companyName")}
          </Typography.Text>
        </Col>
        <Col span={8}>
          <Popover
            title={() => (
              <Flex justify="center" style={{ width: 400 }}>
                <Typography.Text>
                  {progressPercent === 100
                    ? t("footer_batchStatus_completed")
                    : t("footer_batchStatus_progress", {
                        completed: completedCount,
                        total: totalCount,
                      })}
                </Typography.Text>
              </Flex>
            )}
            content={() => (
              <Flex justify="space-between" align="center">
                {isQueueBusy || isCancelling ? (
                  <Button
                    type="primary"
                    danger
                    onClick={handleStopTest}
                    disabled={isCancelling}
                    loading={isCancelling}
                  >
                    {isCancelling
                      ? t("footer_batchStatus_cancelling")
                      : t("footer_batchStatus_abortAndClear")}
                  </Button>
                ) : (
                  <div />
                )}
                <Button
                  disabled={isQueueBusy}
                  loading={isQueueBusy}
                  type={isQueueCompleted ? "primary" : "default"}
                  onClick={handleFinishAndReload}
                >
                  {isQueueBusy
                    ? t("footer_batchStatus_loading")
                    : isQueueCompleted
                    ? t("footer_batchStatus_done")
                    : t("footer_batchStatus_refresh")}
                </Button>
              </Flex>
            )}
            trigger={["click"]}
            open={popoverShow}
            onOpenChange={handleOpenChange}
          >
            <Flex justify="center" align="center" onClick={togglePopover}>
              {!isQueueBusy ? (
                <div></div>
              ) : (
                <Progress
                  percentPosition={{ align: "center", type: "inner" }}
                  percent={progressPercent}
                  format={() => null}
                  style={{ cursor: "pointer" }}
                />
              )}
            </Flex>
          </Popover>
        </Col>
        <Col span={8}>
          <Flex justify="flex-end">
            <Typography.Text
              style={{
                color: "black",
                marginLeft: 10,
                whiteSpace: "nowrap",
                alignSelf: "flex-end",
              }}
            >
              V{APP_VERSION}
            </Typography.Text>
          </Flex>
        </Col>
      </Row>
    </div>
  );
};
export default Footer;
