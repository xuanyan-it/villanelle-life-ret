import {
  PlusCircleOutlined,
  ProfileOutlined,
  UserOutlined,
} from "@ant-design/icons";
import type {
  MenuProps} from "antd";
import {
  Button,
  Descriptions,
  Dropdown,
  Flex,
  Form,
  Steps,
  Tooltip,
  Typography,
} from "antd";
import dayjs from "dayjs";
import React, { useEffect, useMemo, useState } from "react";
/** locales */
import { useTranslation } from "react-i18next";
import { useDispatch, useSelector } from "react-redux";
import { api } from "../../api";
import type { UploadState } from "../../api/types";
import { useBatchProgress } from "../../hooks/useBatchProgress";
import { useRecordImport } from "../../hooks/useRecordImport";
import type { AppDispatch, RootState } from "../../store";
import { getLocale } from "../../store/locale";
import { pushNotification } from "../../store/notification";
import {
  fetchSampleRecordAsync,
  getCurrentPage,
  getDeletedOnly,
  setEvaluationProgressPercent,
  setTestQueueLength,
  updateTestQueue,
} from "../../store/record";
import { getInstituteName, getUsername } from "../../store/user";
import {
  Gender,
  NewMissionType,
} from "../../types";
import DraggableModal from "../DraggableModal";
import SampleSourceForm from "./forms/SampleSourceForm";
/* styles */
import styles from "./new-record.module.css";
import { buildSampleRecordFormItems } from "./newRecordFields";
import type { FormFieldType } from "./newRecordTypes";
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
    patientGender: Gender.None,
    samplingDate: "",
    receptionDate: "",
    patientName: "",
    patientAge: "",
    doctorName: "",
    testerName: username,
    // confirmed at submit
    otherInfo: "",
    modelType: "3class",
    generateHeatmap: false,
  };
  /* state */
  // formData
  // keep form data across step navigation
  const [formData, setFormData] = useState<FormFieldType>({
    ...initialFormData,
  });
  const [pendingFormData, setPendingFormData] = useState<FormFieldType | null>(null);
  // modal
  const [open, setOpen] = useState<boolean>(false);
  const [exitOepn, setExitOpen] = useState<boolean>(false);
  const [submitOpen, setSubmitOpen] = useState<boolean>(false);
  const [currentStep, setCurrentStep] = useState(0);
  // tab and form
  const [sampleSourceFormRef] = Form.useForm();
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
    setOpen(false);
    setExitOpen(false);
    setSubmitOpen(false);
    setCurrentStep(0);
    setFormData({ ...initialFormData });
    setPendingFormData(null);
    resetImport();
    if (resetForms) {
      sampleSourceFormRef.resetFields();
    }
  };
  const handleFormReset = () => {
    sampleSourceFormRef.resetFields();
  };
  const handleReviewSubmit = async () => {
    try {
      const formValues = await sampleSourceFormRef.validateFields();
      for (const key of ["samplingDate", "receptionDate"] as const) {
        formValues[key] = formValues[key] ? dayjs(formValues[key]).format("YYYY-MM-DD") : "";
      }
      const next = { ...formData, ...formValues } as FormFieldType;
      setFormData(next);
      setPendingFormData(next);
      setCurrentStep(1);
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
    const data = pendingFormData;
    const uploadFile = (data as any)?.slideFile?.[0]?.originFileObj as File | undefined;
    if (!data || !uploadFile) return;
    const uploadStartTime = Date.now();
    const current = dayjs().toISOString();
    const resumeKey = `ret-svs-upload:${uploadFile.name}:${uploadFile.size}:${uploadFile.lastModified}`;
    let upload: UploadState | null = null;
    const previousUploadId = localStorage.getItem(resumeKey);
    if (previousUploadId) {
      upload = await api.uploadStatus(previousUploadId);
    }
    if (!upload) {
      upload = await api.uploadInit(uploadFile.name, uploadFile.size);
      localStorage.setItem(resumeKey, upload.uploadId);
    }
    for (let index = 0; index < upload.totalChunks; index += 1) {
      if (upload.uploadedChunks.includes(index)) continue;
      const chunk = uploadFile.slice(index * upload.chunkSize, Math.min(uploadFile.size, (index + 1) * upload.chunkSize));
      await api.uploadChunk(upload.uploadId, index, chunk);
    }
    await api.uploadComplete(upload.uploadId);
    localStorage.removeItem(resumeKey);
    const payload = {
      /*sample source basics */
      uploadId: upload.uploadId,
      slideFileName: uploadFile.name,
      slideId: uploadFile.name.replace(/\.svs$/i, ""),
      samplingDate: data.samplingDate,
      receptionDate: data.receptionDate,
      patientGender: data.patientGender,
      hospitalName: instituteName,
      patientName: data.patientName,
      patientAge: data.patientAge,
      doctorName: data.doctorName,
      testDate: current,
      /* review */
      testerName: username,
      otherInfo: data.otherInfo,
      instituteName: instituteName,
      modelType: data.modelType ?? "3class",
      generateHeatmap: data.generateHeatmap ?? false,
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
        JSON.stringify({ jobUuid, instituteName, uploadStartTime }),
      );

      // 让底部进度条回归：Footer 的进度依赖 Redux 的 testQueue。
      dispatch(updateTestQueue([payload as any]));
      dispatch(setTestQueueLength(1));
      dispatch(setEvaluationProgressPercent(0));
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
            dispatch(setEvaluationProgressPercent(status.progressPercent));
            if (status.status === "succeeded") {
              clearSingleQueue();
              const elapsedS = ((Date.now() - uploadStartTime) / 1000).toFixed(1);
              dispatch(
                pushNotification({
                  type: "success",
                  message: "notification_recordCreate_success_message",
                  description: t("notification_recordCreate_time_elapsed", { seconds: elapsedS }),
                })
              );
              dispatch(fetchSampleRecordAsync({ page: currentPage, deletedOnly }));
              return;
            }
            if (status.status === "failed" || status.status === "cancelled") {
              clearSingleQueue();
              const elapsedS = ((Date.now() - uploadStartTime) / 1000).toFixed(1);
              dispatch(
                pushNotification({
                  type: "error",
                  message: "notification_recordCreate_error_message",
                  description: `${status.errorMessage || t("notification_recordCreate_error_description")} (${elapsedS}s)`
                })
              );
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
  const newRecordForm = (
    <SampleSourceForm
      form={sampleSourceFormRef}
      formItemLayout={formItemLayout}
      items={sampleRecordFormItems}
      onReset={handleFormReset}
      onSubmit={handleReviewSubmit}
      t={t}
    />
  );
  const selectedFile = (pendingFormData as any)?.slideFile?.[0]?.originFileObj as File | undefined;
  const previewItems = pendingFormData ? [
    { key: "file", label: t("newRecord_slideFile"), children: selectedFile ? `${selectedFile.name} (${(selectedFile.size / 1024 / 1024).toFixed(1)} MB)` : "-" },
    { key: "patient", label: sampleRecordFormItems.patientName.label, children: pendingFormData.patientName || t("newRecord_notAvailable") },
    { key: "gender", label: sampleRecordFormItems.patientGender.label, children: pendingFormData.patientGender === Gender.Male ? t("newRecord_sampleSource_patientGender_male") : pendingFormData.patientGender === Gender.Female ? t("newRecord_sampleSource_patientGender_female") : t("newRecord_notAvailable") },
    { key: "age", label: sampleRecordFormItems.patientAge.label, children: pendingFormData.patientAge || t("newRecord_notAvailable") },
    { key: "doctor", label: sampleRecordFormItems.doctorName.label, children: pendingFormData.doctorName || t("newRecord_notAvailable") },
    { key: "sampling", label: sampleRecordFormItems.samplingDate.label, children: pendingFormData.samplingDate || t("newRecord_notAvailable") },
    { key: "reception", label: sampleRecordFormItems.receptionDate.label, children: pendingFormData.receptionDate || t("newRecord_notAvailable") },
    { key: "model", label: sampleRecordFormItems.modelType.label, children: t(`newRecord_modelType_${pendingFormData.modelType}`) },
    { key: "heatmap", label: sampleRecordFormItems.generateHeatmap.label, children: t(pendingFormData.generateHeatmap ? "newRecord_generateHeatmap_yes" : "newRecord_generateHeatmap_no") },
    { key: "other", label: sampleRecordFormItems.otherInfo.label, children: pendingFormData.otherInfo || t("newRecord_notAvailable") },
  ] : [];
  const newRecordContent = (
    <>
      <Steps
        size="small"
        current={currentStep}
        items={[{ title: t("newRecord_recordAndAnalysis") }, { title: t("newRecord_review") }]}
        style={{ margin: "12px 0 8px" }}
      />
      {currentStep === 0 ? newRecordForm : (
        <Flex vertical gap={16} style={{ maxHeight: "calc(100vh - 240px)", overflowY: "auto", padding: "8px 4px" }}>
          <Descriptions bordered size="small" column={2} items={previewItems} />
          <Flex justify="space-between">
            <Button onClick={() => setCurrentStep(0)}>{t("newRecord_previous")}</Button>
            <Button type="primary" onClick={() => setSubmitOpen(true)}>{t("newRecord_submit")}</Button>
          </Flex>
        </Flex>
      )}
    </>
  );
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
      dispatch(setEvaluationProgressPercent(0));

      let stopped = false;
      const run = async () => {
        const intervalMs = 1000;
        const maxAttempts = 900; // ~15min
        let attempt = 0;
        try {
          while (!stopped && attempt < maxAttempts) {
            attempt++;
            const status = await api.evaluationJobStatus({ jobUuid, instituteName });
            dispatch(setEvaluationProgressPercent(status.progressPercent));
            if (status.status === "succeeded") {
              dispatch(updateTestQueue([]));
              dispatch(setTestQueueLength(0));
              sessionStorage.removeItem(sessionKey);
              dispatch(fetchSampleRecordAsync({ page: currentPage, deletedOnly }));
              return;
            }
            if (status.status === "failed" || status.status === "cancelled") {
              dispatch(updateTestQueue([]));
              dispatch(setTestQueueLength(0));
              sessionStorage.removeItem(sessionKey);
              dispatch(
                pushNotification({
                  type: "error",
                  message: "notification_recordCreate_error_message",
                  description: status.errorMessage || "notification_recordCreate_error_description"
                })
              );
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
        dispatch(setEvaluationProgressPercent(active.jobs[0].progressPercent));

        const intervalMs = 1000;
        const maxAttempts = 900;
        let attempt = 0;
        while (!stopped && attempt < maxAttempts) {
          attempt++;
          const status = await api.evaluationJobStatus({ jobUuid, instituteName });
          dispatch(setEvaluationProgressPercent(status.progressPercent));

          const pending = status.items.filter(
            (it) => it.itemStatus === "pending" || it.itemStatus === "evaluating"
          ).length;
          dispatch(setTestQueueLength(status.items.length));
          dispatch(updateTestQueue(new Array(pending).fill({} as any)));

          if (status.status === "succeeded") {
            dispatch(updateTestQueue([]));
            dispatch(setTestQueueLength(0));
            dispatch(fetchSampleRecordAsync({ page: currentPage, deletedOnly }));
            return;
          }
          if (status.status === "failed" || status.status === "cancelled") {
            dispatch(updateTestQueue([]));
            dispatch(setTestQueueLength(0));
            dispatch(
              pushNotification({
                type: "error",
                message: "notification_importMany_enqueue_failed_message",
                description: status.errorMessage || "notification_importMany_enqueue_failed_description",
              })
            );
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
    const batchStartTime = Date.now();
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
      dispatch(setEvaluationProgressPercent(0));

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
            dispatch(setEvaluationProgressPercent(status.progressPercent));

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

            if (status.status === "succeeded") {
              dispatch(updateTestQueue([]));
              dispatch(setTestQueueLength(0));
              const elapsedS = ((Date.now() - batchStartTime) / 1000).toFixed(1);
              dispatch(
                pushNotification({
                  type: "success",
                  message: "notification_importFile_success_message",
                  description: t("notification_recordCreate_time_elapsed", { seconds: elapsedS }),
                })
              );
              dispatch(fetchSampleRecordAsync({ page: currentPage, deletedOnly }));
              return;
            }
            if (status.status === "failed" || status.status === "cancelled") {
              dispatch(updateTestQueue([]));
              dispatch(setTestQueueLength(0));
              const elapsedS = ((Date.now() - batchStartTime) / 1000).toFixed(1);
              dispatch(
                pushNotification({
                  type: "error",
                  message: "notification_importFile_error_message",
                  description: `${status.errorMessage || t("notification_importFile_error_description")} (${elapsedS}s)`,
                })
              );
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
              message: "notification_importFile_error_message",
              description: t("notification_importFile_error_description"),
            })
          );
        }
      })();

      return;
    } catch (error) {
      dispatch(
        pushNotification({
          type: "error",
          message: "notification_importFile_error_message",
          description: t("notification_importFile_error_description"),
        })
      );
    }

    resetAllStates({ resetForms: false });
  };
  return (
    <>
      <Tooltip title={isQueueBusy ? t("newRecord_queueBusy_tooltip") : ""}>
        <Button
          className={styles.new_record_button}
          type="primary"
          icon={<PlusCircleOutlined />}
          disabled={isQueueBusy}
          data-testid="new-record-open"
          onClick={handleOnClickAddOne}
        >
          {t("newRecord_addNewRecord")}
        </Button>
      </Tooltip>
      <DraggableModal
        width={modalWidth}
        title={t("newRecord_addOneTitle")}
        open={open}
        onCancel={closeModal}
        style={{
          padding: 20,
          minWidth: minModalWidth,
          maxWidth: maxModalWidth,
        }}
        destroyOnHidden
        centered
        footer={null}
      >
        {newRecordContent}
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
