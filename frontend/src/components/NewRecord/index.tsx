import {
  PlusCircleOutlined,
  ProfileOutlined,
  UserOutlined,
} from "@ant-design/icons";
import type {
  MenuProps} from "antd";
import {
  Button,
  Dropdown,
  Form,
  Steps,
  Tooltip,
  Typography,
} from "antd";
import type { FormInstance, StepsProps } from "antd/lib";
import dayjs from "dayjs";
import React, { useEffect, useMemo, useState } from "react";
/** locales */
import { useTranslation } from "react-i18next";
import { useDispatch, useSelector } from "react-redux";
import { api } from "../../api";
import { useBatchProgress } from "../../hooks/useBatchProgress";
import { useRecordImport } from "../../hooks/useRecordImport";
import type { AppDispatch, RootState } from "../../store";
import { getLocale } from "../../store/locale";
import { pushNotification } from "../../store/notification";
import {
  fetchSampleRecordAsync,
  getCurrentPage,
  getDeletedOnly,
  setTestQueueLength,
  updateTestQueue,
} from "../../store/record";
import { getInstituteName, getUsername } from "../../store/user";
import {
  Gender,
  NewMissionType,
  SampleType,
} from "../../types";
import DraggableModal from "../DraggableModal";
import GeneInfoForm from "./forms/GeneInfoForm";
import ReviewForm from "./forms/ReviewForm";
import SampleSourceForm from "./forms/SampleSourceForm";
/* styles */
import styles from "./new-record.module.css";
import { buildSampleRecordFormItems } from "./newRecordFields";
import type { FormFieldType, QualityControlType } from "./newRecordTypes";
import { mergeSampleId } from "./newRecordUtils";
import RecordImportBody from "./RecordImportBody";
import RecordImportFooter from "./RecordImportFooter";
const NewRecord: React.FC = () => {
  const { t } = useTranslation();
  // redux state
  const dispatch = useDispatch<AppDispatch>();
  const locale = useSelector((state: RootState) => getLocale(state));
  const username = useSelector((state: RootState) => getUsername(state));
  const instituteName = useSelector((state: RootState) =>
    getInstituteName(state)
  );
  const currentPage = useSelector((state: RootState) => getCurrentPage(state));
  const deletedOnly = useSelector((state: RootState) =>
    getDeletedOnly(state),
  );
  const { isBusy: isQueueBusy } = useBatchProgress();
  const {
    status: importStatus,
    records: importRecords,
    filename: importFilename,
    reset: resetImport,
    parseFile,
  } = useRecordImport();
  const sampleRecordFormItems = useMemo(
    () => buildSampleRecordFormItems(t),
    [t]
  );
  const initialFormData: FormFieldType = {
    sampleId: "",
    patientGender: Gender.None,
    sampleType: "",
    samplingDate: "",
    receptionDate: "",
    RPS4Y1: "",
    PKHD1L1: "",
    CRABP1: "",
    GAPDH: "",
    patientName: "",
    patientAge: "",
    doctorName: "",
    testerName: username,
    // confirmed at submit
    otherInfo: "",
  };
  /* state */
  // formData
  // keep form data across step navigation
  const [formData, setFormData] = useState<FormFieldType>({
    ...initialFormData,
  });
  // modal
  const [open, setOpen] = useState<boolean>(false);
  const [exitOepn, setExitOpen] = useState<boolean>(false);
  const [submitOpen, setSubmitOpen] = useState<boolean>(false);
  // tab and form
  const [currentStep, setCurrentStep] = useState<number>(0);
  const [qualityControlType, setQualityControlType] =
    useState<QualityControlType>("positive");
  const [sampleSourceFormRef] = Form.useForm();
  const [geneInfoFormRef] = Form.useForm();
  const [reviewFormRef] = Form.useForm();
  const [forms] = useState<FormInstance[]>([
    sampleSourceFormRef,
    geneInfoFormRef,
    reviewFormRef,
  ]);
  const watchedSampleType = Form.useWatch(
    sampleRecordFormItems.sampleType.name,
    sampleSourceFormRef
  ) as FormFieldType["sampleType"];
  const [viewportWidth, setViewportWidth] = useState(window.innerWidth);
  const minModalWidth = Math.round(viewportWidth * 0.6);
  const maxModalWidth = viewportWidth;
  const modalWidth = Math.min(
    maxModalWidth,
    Math.max(Math.round(viewportWidth * 0.7), minModalWidth)
  );
  // handler
  const resetAllStates = (options?: { resetForms?: boolean }) => {
    const resetForms = options?.resetForms !== false;
    setCurrentStep(0);
    setOpen(false);
    setExitOpen(false);
    setSubmitOpen(false);
    setFormData({ ...initialFormData });
    resetImport();
    if (resetForms) {
      forms.forEach((form) => form.resetFields());
    }
  };
  const handleFormReset = () => {
    forms[currentStep].resetFields();
  };
  useEffect(() => {
    if (watchedSampleType === SampleType.QualityContral) {
      sampleSourceFormRef.setFieldsValue({
        samplingDate: null,
        receptionDate: null,
        patientGender: Gender.None,
      });
      setQualityControlType((prev) => prev || "positive");
      return;
    }
    const nextValues: Record<string, null> = {};
    const samplingValue = sampleSourceFormRef.getFieldValue(
      sampleRecordFormItems.samplingDate.name
    );
    const receptionValue = sampleSourceFormRef.getFieldValue(
      sampleRecordFormItems.receptionDate.name
    );
    if (samplingValue === "n/a") {
      nextValues[sampleRecordFormItems.samplingDate.name] = null;
    }
    if (receptionValue === "n/a") {
      nextValues[sampleRecordFormItems.receptionDate.name] = null;
    }
    if (Object.keys(nextValues).length) {
      sampleSourceFormRef.setFieldsValue(nextValues);
    }
  }, [
    watchedSampleType,
    sampleSourceFormRef,
    sampleRecordFormItems.samplingDate.name,
    sampleRecordFormItems.receptionDate.name,
  ]);
  const handleNext = async () => {
    try {
      const formValues = await forms[currentStep].validateFields();
      if (
        currentStep === 0 &&
        formValues[sampleRecordFormItems.sampleType.name] ===
          SampleType.QualityContral
      ) {
        formValues[sampleRecordFormItems.samplingDate.name] = "n/a";
        formValues[sampleRecordFormItems.receptionDate.name] = "n/a";
      }
      Object.keys(formValues).forEach((key) => {
        if (!formValues[key]) {
          formValues[key] = "n/a";
        }
        if (key === "samplingDate" || key === "receptionDate") {
          if (formValues[key] !== "n/a") {
            formValues[key] = dayjs(formValues[key]).format("YYYY-MM-DD");
          }
        }
      });
      setFormData((prev) => ({ ...prev, ...formValues }));
      setCurrentStep(currentStep + 1);
    } catch (error) {}
  };
  const handlePrevious = () => {
    setCurrentStep(currentStep - 1);
  };
  const handleReviewSubmit = async () => {
    try {
      const formValues = await forms[currentStep].validateFields();
      setFormData((prev) => ({
        ...prev,
        ...formValues,
      }));
      setSubmitOpen(true);
    } catch (error) {}
  };
  const closeModal = () => {
    setExitOpen(true);
  };
  const handleCancelExit = () => {
    setExitOpen(false);
  };
  const handleConfirmExit = () => {
    resetAllStates();
  };
  const handleCancelSubmit = () => {
    setSubmitOpen(false);
  };
  const handleConfirmSubmit = async () => {
    console.log("finally", formData);
    if (!formData.sampleType) {
      return;
    }
    const current = dayjs().toISOString();
    const mergedSampleId = mergeSampleId(
      formData.sampleId,
      formData.sampleType,
      qualityControlType
    );
    const payload = {
      /*sample source basics */
      sampleId: mergedSampleId,
      sampleType: formData.sampleType,
      samplingDate: formData.samplingDate,
      receptionDate: formData.receptionDate,
      patientGender: formData.patientGender,
      hospitalName: instituteName,
      patientName: formData.patientName,
      patientAge: formData.patientAge,
      doctorName: formData.doctorName,
      /* gene */
      PKHD1L1: formData.PKHD1L1,
      RPS4Y1: formData.RPS4Y1,
      CRABP1: formData.CRABP1,
      GAPDH: formData.GAPDH,
      testDate: current,
      /* review */
      testerName: username,
      otherInfo: formData.otherInfo,
      instituteName: instituteName,
    };

    const sessionKey = "evaluation_job_single_mvp";
    const clearSingleQueue = () => {
      dispatch(updateTestQueue([]));
      dispatch(setTestQueueLength(0));
      sessionStorage.removeItem(sessionKey);
    };

    try {
      // Web 单条 MVP：请求携带 evaluationAsync=true，后端后台更新 record.result。
      const created = await api.createSampleRecords({
        ...(payload as any),
        evaluationAsync: true
      } as any);
      const jobUuid = created.uuid;
      sessionStorage.setItem(
        sessionKey,
        JSON.stringify({ jobUuid, instituteName }),
      );

      // 让底部进度条回归：Footer 的进度依赖 Redux 的 testQueue。
      dispatch(updateTestQueue([payload as any]));
      dispatch(setTestQueueLength(1));
      resetAllStates();

      // 轮询直到终态，并最终触发表格刷新（刷新后也会从 sessionStorage 恢复）。
      const poll = async () => {
        const intervalMs = 1000;
        const maxAttempts = 900; // ~15min
        let attempt = 0;
        try {
          while (attempt < maxAttempts) {
            attempt++;
            const status = await api.evaluationJobStatus({ jobUuid, instituteName });
            if (
              status.status === "succeeded" ||
              status.status === "failed" ||
              status.status === "cancelled"
            ) {
              clearSingleQueue();
              dispatch(fetchSampleRecordAsync({ page: currentPage, deletedOnly }));
              return;
            }
            await new Promise((r) => setTimeout(r, intervalMs));
          }
          clearSingleQueue();
          dispatch(
            pushNotification({
              type: "error",
              message: "notification_recordCreate_error_message",
              description: "notification_recordCreate_error_description"
            })
          );
        } catch {
          clearSingleQueue();
          dispatch(
            pushNotification({
              type: "error",
              message: "notification_recordCreate_error_message",
              description: "notification_recordCreate_error_description"
            })
          );
        }
      };

      void poll();
    } catch {
      clearSingleQueue();
      setSubmitOpen(false);
      dispatch(
        pushNotification({
          type: "error",
          message: "notification_recordCreate_error_message",
          description: "notification_recordCreate_error_description"
        })
      );
    }
  };
  // form item layout
  const formItemLayout = {
    labelCol: {
      xs: { span: 24 },
      sm: { span: 24 },
      md: { span: 8 },
      lg: { span: 8 },
      xl: { span: 8 },
      xxl: { span: 8 },
    },
    wrapperCol: {
      xs: { span: 24 },
      sm: { span: 24 },
      md: { span: 24 },
      lg: { span: 24 },
      xl: { span: 24 },
      xxl: { span: 24 },
    },
  };
  const steps = [
    {
      key: t("newRecord_sampleSource"),
      content: (
        <SampleSourceForm
          form={sampleSourceFormRef}
          formItemLayout={formItemLayout}
          items={sampleRecordFormItems}
          watchedSampleType={watchedSampleType}
          qualityControlType={qualityControlType}
          setQualityControlType={setQualityControlType}
          onReset={handleFormReset}
          onNext={handleNext}
          t={t}
        />
      ),
    },
    {
      key: t("newRecord_geneInfo"),
      content: (
        <GeneInfoForm
          form={geneInfoFormRef}
          formItemLayout={formItemLayout}
          items={sampleRecordFormItems}
          username={username}
          onReset={handleFormReset}
          onPrevious={handlePrevious}
          onNext={handleNext}
          t={t}
        />
      ),
    },
    {
      key: t("newRecord_review"),
      content: (
        <ReviewForm
          form={reviewFormRef}
          formItemLayout={formItemLayout}
          items={sampleRecordFormItems}
          formData={formData}
          qualityControlType={qualityControlType}
          onPrevious={handlePrevious}
          onSubmit={handleReviewSubmit}
          t={t}
        />
      ),
    },
  ];
  const stepItems: StepsProps["items"] = Object.values(steps).map((item) => ({
    key: item.key,
    title: item.key,
  }));
  // drop down button
  const [newMissionType, setNewMissionType] = useState<NewMissionType>(
    NewMissionType.AddOne
  );
  const handleOnClickAddOne = () => {
    setNewMissionType(NewMissionType.AddOne);
    setOpen(true);
  };
  useEffect(() => {
    const handleResize = () => {
      setViewportWidth(window.innerWidth);
    };
    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  // 单条：刷新恢复轮询
  useEffect(() => {
    const sessionKey = "evaluation_job_single_mvp";
    const raw = sessionStorage.getItem(sessionKey);
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw) as { jobUuid: string; instituteName: string };
      const jobUuid = parsed.jobUuid;
      const instituteName = parsed.instituteName;

      // 刷新恢复：同样触发 Footer 进度条（pending=1）。
      dispatch(updateTestQueue([{} as any]));
      dispatch(setTestQueueLength(1));

      let stopped = false;
      const run = async () => {
        const intervalMs = 1000;
        const maxAttempts = 900; // ~15min
        let attempt = 0;
        try {
          while (!stopped && attempt < maxAttempts) {
            attempt++;
            const status = await api.evaluationJobStatus({ jobUuid, instituteName });
            if (
              status.status === "succeeded" ||
              status.status === "failed" ||
              status.status === "cancelled"
            ) {
              dispatch(updateTestQueue([]));
              dispatch(setTestQueueLength(0));
              sessionStorage.removeItem(sessionKey);
              dispatch(fetchSampleRecordAsync({ page: currentPage, deletedOnly }));
              return;
            }
            await new Promise((r) => setTimeout(r, intervalMs));
          }
        } catch {
          dispatch(updateTestQueue([]));
          dispatch(setTestQueueLength(0));
          sessionStorage.removeItem(sessionKey);
        }
      };
      void run();
      return () => {
        stopped = true;
      };
    } catch {
      // ignore invalid sessionStorage payload
      sessionStorage.removeItem("evaluation_job_single_mvp");
    }
  }, []);

  // 批量：刷新恢复 active job（不依赖 sessionStorage）
  useEffect(() => {
    let stopped = false;
    const run = async () => {
      try {
        const active = await api.activeEvaluationJobs({ instituteName });
        if (stopped) return;

        if (!active.jobs.length) {
          dispatch(updateTestQueue([]));
          dispatch(setTestQueueLength(0));
          return;
        }

        const { jobUuid, items } = active.jobs[0];
        const totalCount = items.length;
        const pendingCount = items.filter(
          (it) => it.itemStatus === "pending" || it.itemStatus === "evaluating"
        ).length;

        dispatch(setTestQueueLength(totalCount));
        dispatch(updateTestQueue(new Array(pendingCount).fill({} as any)));

        const intervalMs = 1000;
        const maxAttempts = 900;
        let attempt = 0;
        while (!stopped && attempt < maxAttempts) {
          attempt++;
          const status = await api.evaluationJobStatus({ jobUuid, instituteName });

          const pending = status.items.filter(
            (it) => it.itemStatus === "pending" || it.itemStatus === "evaluating"
          ).length;
          dispatch(setTestQueueLength(status.items.length));
          dispatch(updateTestQueue(new Array(pending).fill({} as any)));

          if (
            status.status === "succeeded" ||
            status.status === "failed" ||
            status.status === "cancelled"
          ) {
            dispatch(updateTestQueue([]));
            dispatch(setTestQueueLength(0));
            dispatch(fetchSampleRecordAsync({ page: currentPage, deletedOnly }));
            return;
          }
          await new Promise((r) => setTimeout(r, intervalMs));
        }
      } catch {
        dispatch(updateTestQueue([]));
        dispatch(setTestQueueLength(0));
      }
    };

    void run();
    return () => {
      stopped = true;
    };
  }, [instituteName, currentPage, deletedOnly]);
  const handleOnClickImportMany = () => {
    setNewMissionType(NewMissionType.ImportMany);
    setOpen(true);
  };
  // add-menu options
  const addButtonItems: MenuProps["items"] = [
    {
      label: <span data-testid="new-record-add-one">{t("newRecord_addOne")}</span>,
      key: "1",
      icon: <UserOutlined />,
      onClick: handleOnClickAddOne,
    },
    {
      label: <span data-testid="new-record-import-many">{t("newRecord_importMany")}</span>,
      key: "2",
      icon: <ProfileOutlined />,
      onClick: handleOnClickImportMany,
    },
  ];
  const handleSubmitUpload = async () => {
    if (!importRecords.length) {
      return;
    }
    // add testDate last minute
    const current = dayjs().toISOString();
    const requestPayloadArr = importRecords.map((item) => ({
      ...item,
      hospitalName: instituteName,
      testDate: current,
      instituteName,
    }));

    try {
      const { jobUuid } = await api.batchEnqueueEvaluationJobs({
        instituteName,
        records: requestPayloadArr,
        evaluationJobStart: true,
      });

      // 用 job 的 items 状态映射进度条：testQueueLength=总数，testQueue=pending/ evaluating 的数量
      dispatch(setTestQueueLength(requestPayloadArr.length));
      dispatch(updateTestQueue(new Array(requestPayloadArr.length).fill({} as any)));

      // 立刻关闭导入弹窗，不要阻塞 UI 等待轮询结束
      resetAllStates({ resetForms: false });

      const intervalMs = 1000;
      const maxAttempts = 900;
      void (async () => {
        let attempt = 0;
        let lastPendingCount = requestPayloadArr.length;
        try {
          while (attempt < maxAttempts) {
            attempt++;
            const status = await api.evaluationJobStatus({ jobUuid, instituteName });

            const pendingCount = status.items.filter(
              (it) => it.itemStatus === "pending" || it.itemStatus === "evaluating"
            ).length;
            dispatch(setTestQueueLength(status.items.length));
            dispatch(updateTestQueue(new Array(pendingCount).fill({} as any)));

            // 轮询到进度变化（已有 items 完成）就刷新列表展示最新 record.result
            if (pendingCount !== lastPendingCount) {
              lastPendingCount = pendingCount;
              dispatch(fetchSampleRecordAsync({ page: currentPage, deletedOnly }));
            }

            if (
              status.status === "succeeded" ||
              status.status === "failed" ||
              status.status === "cancelled"
            ) {
              dispatch(updateTestQueue([]));
              dispatch(setTestQueueLength(0));
              dispatch(fetchSampleRecordAsync({ page: currentPage, deletedOnly }));
              return;
            }

            await new Promise((r) => setTimeout(r, intervalMs));
          }
        } catch {
          dispatch(updateTestQueue([]));
          dispatch(setTestQueueLength(0));
          dispatch(
            pushNotification({
              type: "error",
              message: "notification_importMany_enqueue_failed_message",
              description: "notification_importMany_enqueue_failed_description",
            })
          );
        }
      })();

      return;
    } catch (error) {
      dispatch(
        pushNotification({
          type: "error",
          message: "notification_importMany_enqueue_failed_message",
          description: "notification_importMany_enqueue_failed_description",
        })
      );
    }

    resetAllStates({ resetForms: false });
  };
  return (
    <>
      <Dropdown
        className={styles.new_record_button}
        menu={{ items: addButtonItems }}
        arrow
        trigger={["click"]}
        disabled={isQueueBusy}
      >
        <Tooltip
          title={isQueueBusy ? t("newRecord_queueBusy_tooltip") : ""}
        >
          <span>
            <Button
              type="primary"
              icon={<PlusCircleOutlined />}
              disabled={isQueueBusy}
              data-testid="new-record-open"
            >
              {t("newRecord_addNewRecord")}
            </Button>
          </span>
        </Tooltip>
      </Dropdown>
      <DraggableModal
        width={modalWidth}
        title={
          newMissionType === NewMissionType.AddOne ? (
            t("newRecord_addOneTitle")
          ) : (
            <Typography.Text style={{ fontSize: 16 }}>
              {t("newRecord_importManyTitle")}
            </Typography.Text>
          )
        }
        open={open}
        onCancel={closeModal}
        style={{
          padding: 20,
          minWidth: minModalWidth,
          maxWidth: maxModalWidth,
        }}
        destroyOnHidden
        centered
        footer={[
          newMissionType === NewMissionType.ImportMany && (
            <RecordImportFooter
              key="importFooterContainer"
              t={t}
              disableSubmit={
                !importRecords.length || importStatus === "parsing"
              }
              submitLoading={importStatus === "parsing"}
              onCancel={closeModal}
              onSubmit={handleSubmitUpload}
              onBeforeUpload={async (file) => {
                try {
                  const ret = await parseFile(file, (item) => ({
                    ...item,
                    instituteName,
                    testerName: username,
                  }));
                  dispatch(
                    pushNotification({
                      type: "success",
                      message: "notification_importFile_success_message",
                      description: "",
                    })
                  );
                  if (!ret.length) {
                    dispatch(
                      pushNotification({
                        type: "error",
                        message: "notification_importFile_error_message",
                        description: "notification_importFile_error_description",
                      })
                    );
                    resetImport();
                  }
                } catch (error) {
                  dispatch(
                    pushNotification({
                      type: "error",
                      message: "notification_importFile_error_message",
                      description: "notification_importFile_error_description",
                    })
                  );
                }
                return false;
              }}
              onRemove={() => resetImport()}
              onDownloadTemplate={async () => {
                try {
                  const result = await api.download(`template_${locale}.csv`);
                  if (!result.canceled) {
                    dispatch(
                      pushNotification({
                        type: "success",
                        message: "notification_download_success_message",
                        description: "",
                      })
                    );
                  }
                } catch (error) {
                  dispatch(
                    pushNotification({
                      type: "error",
                      message: "notification_download_error_message",
                      description: "",
                    })
                  );
                }
              }}
            />
          ),
        ]}
      >
        {newMissionType === NewMissionType.AddOne ? (
          <>
            <Steps
              labelPlacement="vertical"
              current={currentStep}
              items={stepItems}
              style={{ marginTop: 20 }}
            />
            {steps[currentStep].content}
          </>
        ) : (
          <>
            <RecordImportBody
              filename={importFilename}
              formItemLayout={formItemLayout}
            />
          </>
        )}
      </DraggableModal>
      <DraggableModal
        width={"30%"}
        title={t("newRecord_cancelRecord_title")}
        open={exitOepn}
        onOk={handleConfirmExit}
        onCancel={handleCancelExit}
        style={{ padding: 20 }}
        footer={[
          <Button key="cancelCancel" type="default" onClick={handleCancelExit}>
            {t("newRecord_cancel")}
          </Button>,
          <Button
            key="confirmCancel"
            type="primary"
            onClick={handleConfirmExit}
          >
            {t("newRecord_confirm")}
          </Button>,
        ]}
        destroyOnHidden
        centered
      >
        {t("newRecord_cancelRecord_content")}
      </DraggableModal>
      <DraggableModal
        width={400}
        title={t("newRecord_confirmSubmit_title")}
        open={submitOpen}
        onOk={handleConfirmSubmit}
        onCancel={handleCancelSubmit}
        style={{ padding: 20 }}
        footer={[
          <Button
            key="cancelSubmit"
            type="default"
            onClick={handleCancelSubmit}
          >
            {t("newRecord_cancel")}
          </Button>,
          <Button
            key="confirmSubmit"
            type="primary"
            onClick={handleConfirmSubmit}
          >
            {t("newRecord_confirm")}
          </Button>,
        ]}
        destroyOnHidden
        centered
      >
        {t("newRecord_confirmSubmit_content")}
      </DraggableModal>
    </>
  );
};
export default NewRecord;
