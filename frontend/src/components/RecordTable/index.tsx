import { DeleteOutlined, RollbackOutlined, SearchOutlined } from "@ant-design/icons";
import type { ActionType, ProColumns } from "@ant-design/pro-components";
import { ProTable } from "@ant-design/pro-components";
import type { MenuProps } from "antd";
import {
  Button,
  Checkbox,
  Col,
  ConfigProvider,
  Descriptions,
  Divider,
  Dropdown,
  Flex,
  Form,
  Image,
  Input,
  Pagination,
  Row,
  Select,
  Space,
  Spin,
  Tabs,
  Tag,
  // Tooltip,
  Typography,
} from "antd";
import type { DescriptionsProps } from "antd/lib";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useDispatch, useSelector } from "react-redux";
import { api } from "../../api";
import OpenSeadragon from "openseadragon";
import { isElectronRuntime as detectElectronRuntime } from "../../platform/runtime";
import { SvsViewer } from "../SvsViewer";
import type { AppDispatch, RootState } from "../../store";
import { fetchUserListAsync, getUserList } from "../../store/admin";
import { pushNotification } from "../../store/notification";
import {
  deleteSampleRecordAsync,
  fetchSampleRecordAsync,
  getCurrentPage,
  getDeletedOnly,
  getPageSize,
  getRecordList,
  getRecordTableStatus,
  getSearchKeyword,
  getSelectedRowKeys,
  getSelectedRows,
  getTotalRecords,
  setCurrentPage,
  setDeletedOnly,
  setSearchKeyword,
  setSelectedRows,
  unselectRows,
} from "../../store/record";
import {
  getEmail,
  getInstituteName,
  getUsername,
  // getUserRole,
} from "../../store/user";
import type { SampleRecordResponsePayload } from "../../types";
import {
  Gender,
  RequestStatus,
  // SampleRecord,
} from "../../types";
import { isFieldValueNullString } from "../../utils/nullCheck";
import { buildCsvContent, objectArr2csv } from "../../utils/recordParser";
import DraggableModal from "../DraggableModal";
import {
  filterVisibleRecords,
  getResultLabelKey,
  getResultTagColor,
} from "./recordTable.logic";
import styles from "./record-table.module.css";
// import { ellipsisText } from "../../utils/ellipsisText";
// import { openReportPreviewer } from "../../store/reportPreviewer";

const EvaluationResultTag = ({
  result,
  modelType,
  deleted = false,
}: {
  result: string;
  modelType?: string;
  deleted?: boolean;
}) => {
  const { t } = useTranslation();
  const labelKey = getResultLabelKey(result, modelType);
  const label = labelKey ? t(labelKey) : result || t("recordTable_notAvailable");
  return (
    <Tag color={deleted ? "default" : getResultTagColor(result, modelType)}>
      <span
        style={
          deleted
            ? { textDecoration: "line-through", color: "#666" }
            : undefined
        }
      >
        {label}
      </span>
    </Tag>
  );
};

const HeatmapPreview = ({
  uploadId,
  enabled,
}: {
  uploadId: string;
  enabled: boolean;
}) => {
  const { t } = useTranslation();
  const [loadFailed, setLoadFailed] = useState(false);
  const [src, setSrc] = useState<string | null>(null);
  const [slideSrc, setSlideSrc] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoadFailed(false);
    setSrc(null);
    setSlideSrc(null);
    if (!enabled || !uploadId) {
      return () => {
        active = false;
      };
    }
    void Promise.all([
      api.heatmapSource(uploadId),
      api.slidePreviewSource(uploadId),
    ])
      .then(([heatmapValue, slideValue]) => {
        if (active) {
          setSrc(heatmapValue);
          setSlideSrc(slideValue);
          setLoadFailed(!heatmapValue);
        }
      })
      .catch(() => {
        if (active) {
          setLoadFailed(true);
        }
      });
    return () => {
      active = false;
    };
  }, [enabled, uploadId]);

  if (!enabled) {
    return (
      <Typography.Text type="secondary">
        {t("recordTable_geneInfo_heatmapNotRequested")}
      </Typography.Text>
    );
  }
  if (loadFailed) {
    return (
      <Typography.Text type="secondary">
        {t("recordTable_geneInfo_heatmapUnavailable")}
      </Typography.Text>
    );
  }
  if (!src) {
    return <Typography.Text type="secondary">...</Typography.Text>;
  }

  return (
    <div className={styles.heatmapPreview} data-testid="record-detail-heatmap">
      <Image.PreviewGroup>
        <div className={styles.slidePreviewItem}>
          <Typography.Text type="secondary">
            {t("recordTable_geneInfo_heatmapHd")}
          </Typography.Text>
          <Image
            src={src}
            alt={t("recordTable_geneInfo_heatmap")}
            width="100%"
            className={styles.heatmapImage}
            onError={() => setLoadFailed(true)}
            preview={{ mask: t("recordTable_geneInfo_heatmapPreview") }}
          />
        </div>
        {slideSrc ? (
          <div className={styles.slidePreviewItem}>
            <Typography.Text type="secondary">
              {t("recordTable_geneInfo_slidePreview")}
            </Typography.Text>
            <Image
              src={slideSrc}
              alt={t("recordTable_geneInfo_slidePreview")}
              width="100%"
              className={styles.heatmapImage}
              onError={() => setSlideSrc(null)}
              preview={{ mask: t("recordTable_geneInfo_heatmapPreview") }}
            />
          </div>
        ) : null}
      </Image.PreviewGroup>
    </div>
  );
};

/** OSD viewer for heatmap images — provides zoom/pan for large heatmaps. */
const HeatmapOsdViewer = ({ src, loading, regenerating, onRegenerate }: {
  src: string | null;
  loading: boolean;
  regenerating?: boolean;
  onRegenerate?: () => void;
}) => {
  const { t } = useTranslation();
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<OpenSeadragon.Viewer | null>(null);

  useEffect(() => {
    if (!src || !containerRef.current) return;
    if (viewerRef.current) {
      viewerRef.current.destroy();
      viewerRef.current = null;
    }
    const viewer = OpenSeadragon({
      element: containerRef.current,
      prefixUrl: "/openseadragon/images/",
      tileSources: { type: "image" as any, url: src },
      visibilityRatio: 1,
      minZoomImageRatio: 1,
      showNavigationControl: true,
      showNavigator: true,
      navigatorPosition: "BOTTOM_RIGHT",
      navigatorSizeRatio: 0.15,
      immediateRender: false,
      constrainDuringPan: true,
    });
    viewerRef.current = viewer;
    return () => {
      viewer.destroy();
      viewerRef.current = null;
    };
  }, [src]);

  if (loading) {
    return (
      <Flex vertical align="center" justify="center" style={{ height: "100%", background: "#111" }} gap={12}>
        <Spin size="large" />
        <Typography.Text style={{ color: "#ccc" }}>正在加载热力图…</Typography.Text>
      </Flex>
    );
  }

  if (!src) {
    return (
      <Flex vertical align="center" justify="center" style={{ height: "100%", background: "#111" }} gap={12}>
        <Typography.Text style={{ color: "#ccc" }}>{t("recordTable_geneInfo_heatmapUnavailable")}</Typography.Text>
        {onRegenerate && (
          <Button type="primary" loading={regenerating} onClick={onRegenerate}>
            生成热力图
          </Button>
        )}
      </Flex>
    );
  }

  return <div ref={containerRef} style={{ width: "100%", height: "100%", background: "#111" }} />;
};

const RecordTable = () => {
  const ref = useRef<ActionType>();
  const pageChangeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // reset table scrollY
  const [scrollY, setScrollY] = useState(window.innerHeight - 260);
  const getWindowSize = useCallback(
    () => ({
      innerHeight: window.innerHeight,
      innerWidth: window.innerWidth,
    }),
    [],
  );
  const handleWindowSizeChange = useCallback(() => {
    setScrollY(getWindowSize().innerHeight - 260);
  }, [getWindowSize]);
  useEffect(() => {
    window.addEventListener("resize", handleWindowSizeChange);
    return () => {
      window.removeEventListener("resize", handleWindowSizeChange);
    };
  }, [handleWindowSizeChange]);
  const dispatch = useDispatch<AppDispatch>();
  const isElectronRuntime = detectElectronRuntime();
  const instituteName = useSelector((state: RootState) =>
    getInstituteName(state),
  );
  const username = useSelector((state: RootState) => getUsername(state));
  const email = useSelector((state: RootState) => getEmail(state));
  const userList = useSelector((state: RootState) => getUserList(state));
  const reviewerUsers = useMemo(
    () => userList.filter((user) => user.email !== email),
    [email, userList],
  );
  const reviewerOptions = useMemo(
    () =>
      reviewerUsers.map((user) => ({
        label: user.username,
        value: user.email,
      })),
    [reviewerUsers],
  );
  // const userRole = useSelector((state: RootState) => getUserRole(state));
  const tableLoading = useSelector(
    (state: RootState) => getRecordTableStatus(state) === RequestStatus.Pending,
  );
  // i18n
  const { t } = useTranslation();
  useEffect(() => {
    if (!instituteName) {
      return;
    }
    if (!userList.length) {
      dispatch(
        fetchUserListAsync({
          instituteName,
        }),
      );
    }
  }, [dispatch, instituteName, userList.length]);
  const [printConfirmationForm] = Form.useForm();
  const [reviewerName, setReviewerName] = useState<string>("");
  const [reviewerEmail, setReviewerEmail] = useState<string>("");
  const [reviewerCandidate, setReviewerCandidate] = useState<
    (typeof reviewerUsers)[number] | null
  >(null);
  const [reviewerVerified, setReviewerVerified] = useState<boolean>(false);
  const [reviewerPassword, setReviewerPassword] = useState<string>("");
  const [reviewerPasswordOpen, setReviewerPasswordOpen] =
    useState<boolean>(false);
  const [reviewerPasswordLoading, setReviewerPasswordLoading] =
    useState<boolean>(false);
  const [descriptionOpen, setDescriptionOpen] = useState<boolean>(false);
  const [descriptionTitle, setDescriptionTitle] = useState<string>("");
  const [descriptionDeleted, setDescriptionDeleted] = useState<boolean>(false);
  const [sampleSourceDescriptionItems, setSampleSourceDescriptionItems] =
    useState<DescriptionsProps["items"]>();
  const [geneInfoDescriptionItems, setGeneInfoDescriptionItems] =
    useState<DescriptionsProps["items"]>();
  const [reviewDescriptionItems, setReviewDescriptionItems] =
    useState<DescriptionsProps["items"]>();
  const [detailUploadId, setDetailUploadId] = useState<string>("");
  const [detailRecord, setDetailRecord] = useState<any>(null);
  const [regeneratingHeatmap, setRegeneratingHeatmap] = useState(false);
  const [heatmapSrc, setHeatmapSrc] = useState<string | null>(null);
  const [heatmapChecking, setHeatmapChecking] = useState(false);
  const showDeletedOnly = useSelector((state: RootState) =>
    getDeletedOnly(state),
  );
  const searchKeyword = useSelector((state: RootState) =>
    getSearchKeyword(state),
  );
  const [searchInput, setSearchInput] = useState(searchKeyword);
  useEffect(() => {
    setSearchInput(searchKeyword);
  }, [searchKeyword]);

  // Check heatmap status when detail modal opens
  useEffect(() => {
    if (!detailUploadId) {
      setHeatmapSrc(null);
      return;
    }
    let active = true;
    setHeatmapChecking(true);
    api.heatmapSource(detailUploadId)
      .then((src) => { if (active) setHeatmapSrc(src); })
      .catch(() => { if (active) setHeatmapSrc(null); })
      .finally(() => { if (active) setHeatmapChecking(false); });
    return () => { active = false; };
  }, [detailUploadId]);
  const handleSearch = useCallback(
    (value: string) => {
      const nextKeyword = value.trim();
      dispatch(setSearchKeyword(nextKeyword));
      dispatch(setCurrentPage(1));
      dispatch(unselectRows());
    },
    [dispatch],
  );
  const handleOpenSampleDetail = (record: SampleRecordResponsePayload) => {
    setDescriptionOpen(true);
    setDescriptionDeleted(Boolean(record.isDeleted));
    const withDelete = (items: DescriptionsProps["items"]) =>
      record.isDeleted
        ? items?.map((item) => ({
            ...item,
            children: (
              <span
                style={{
                  textDecoration: "line-through",
                  textDecorationColor: "#000",
                }}
              >
                {item.children}
              </span>
            ),
          }))
        : items;
    const sampleSourceItems: DescriptionsProps["items"] = [
      {
        key: "7",
        label: t("recordTable_slideFileName"),
        children: record.slideFileName,
      },
      {
        key: "10",
        label: t("recordTable_geneInfo_samplingDate"),
        children: record.samplingDate.substring(0, 10),
      },
      {
        key: "11",
        label: t("recordTable_geneInfo_receptionDate"),
        children: record.receptionDate.substring(0, 10),
      },
      {
        key: "12",
        label: t("recordTable_geneInfo_testDate"),
        children: record.testDate.substring(0, 10),
      },
      // {
      //   key: "1",
      //   label: t("recordTable_sampleSource_hospitalName"),
      //   children: record.hospitalName,
      // },
      {
        key: "3",
        label: t("recordTable_sampleSource_doctorName"),
        children: isFieldValueNullString(record.doctorName)
          ? record.doctorName
          : t("recordTable_notAvailable"),
      },
      {
        key: "4",
        label: t("recordTable_sampleSource_patientName"),
        children: isFieldValueNullString(record.patientName)
          ? record.patientName
          : t("recordTable_notAvailable"),
      },
      {
        key: "5",
        label: t("recordTable_sampleSource_patientAge"),
        children: isFieldValueNullString(record.patientAge)
          ? record.patientAge
          : t("recordTable_notAvailable"),
      },
      {
        key: "6",
        label: t("recordTable_sampleSource_patientGender"),
        children:
          record.patientGender === Gender.None
            ? t("recordTable_notAvailable")
            : record.patientGender === Gender.Male
              ? t("recordTable_sampleSource_patientGender_male")
              : t("recordTable_sampleSource_patientGender_female"),
      },
    ];
    const geneInfoItems: DescriptionsProps["items"] = [
      {
        key: "18",
        label: t("recordTable_geneInfo_evaluationResult"),
        children: (
          <EvaluationResultTag
            result={record.result}
            modelType={record.modelType}
            deleted={Boolean(record.isDeleted)}
          />
        ),
      },
    ];
    const reviewItems: DescriptionsProps["items"] = [
      {
        key: "19",
        label: t("recordTable_review_testerName"),
        children: record.testerName,
      },
      {
        key: "19-reviewer",
        label: t("recordTable_review_reviewerName"),
        children: (
          <span data-testid="record-detail-reviewer-name">
            {isFieldValueNullString(record.reviewerName)
              ? record.reviewerName
              : t("recordTable_notAvailable")}
          </span>
        ),
      },
      {
        key: "20",
        label: t("recordTable_review_otherInfo"),
        children: isFieldValueNullString(record.otherInfo)
          ? record.otherInfo
          : t("recordTable_notAvailable"),
      },
    ];
    setDescriptionTitle(record.slideFileName.concat(" - ", record.hospitalName));
    setDetailUploadId(record.uploadId);
    setDetailRecord(record);
    setSampleSourceDescriptionItems(withDelete(sampleSourceItems));
    setGeneInfoDescriptionItems(withDelete(geneInfoItems));
    setReviewDescriptionItems(withDelete(reviewItems));
  };
  const handleCloseSampleDetail = () => {
    setDescriptionOpen(false);
    setDetailUploadId("");
    setDetailRecord(null);
    setSampleSourceDescriptionItems({} as DescriptionsProps["items"]);
    setGeneInfoDescriptionItems({} as DescriptionsProps["items"]);
    setReviewDescriptionItems({} as DescriptionsProps["items"]);
  };

  const handleRegenerateHeatmap = async (record: any) => {
    setRegeneratingHeatmap(true);
    setHeatmapSrc(null);
    try {
      await api.createSampleRecords({
        ...record,
        generateHeatmap: true,
        evaluationAsync: true,
      } as any);
      dispatch(pushNotification({
        type: "success",
        message: "热力图生成已提交",
        description: "请等待评估完成后刷新查看",
      }));
    } catch {
      dispatch(pushNotification({
        type: "error",
        message: "热力图生成失败",
        description: "请稍后重试",
      }));
    } finally {
      setRegeneratingHeatmap(false);
    }
  };

  const handleToggleDeletedView = () => {
    const next = !showDeletedOnly;
    dispatch(setDeletedOnly(next));
    dispatch(setCurrentPage(1));
    dispatch(unselectRows());
  };
  const confirmatioFormItemLayout = {
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
  /* delete */
  const [deleteConfirmationOpen, setDeleteConfirmationOpen] =
    useState<boolean>(false);
  // const [deleteConfirmationTitle, setDeleteConfirmationTitle] =
  // useState<string>("");
  /* print */
  const [printConfirmationOpen, setPrintConfirmationOpen] =
    useState<boolean>(false);
  const [printDescriptionTitle, setPrintDescriptionTitle] =
    useState<string>("");
  const [printableRecord, setPrintableRecord] =
    useState<SampleRecordResponsePayload>({} as SampleRecordResponsePayload);
  const [printLoading, setPrintLoading] = useState<boolean>(false);
  const pdfUrlRef = useRef<string | null>(null);
  const resetReviewerState = () => {
    setReviewerName("");
    setReviewerEmail("");
    setReviewerCandidate(null);
    setReviewerVerified(false);
    setReviewerPassword("");
    setReviewerPasswordOpen(false);
    setReviewerPasswordLoading(false);
    printConfirmationForm.resetFields();
  };
  const handleReviewerSelect = useCallback(
    (value: string) => {
      const target = reviewerUsers.find((item) => item.email === value);
      if (!target) {
        return;
      }
      if (target.email === email) {
        return;
      }
      setReviewerCandidate(target);
      setReviewerEmail(value);
      setReviewerVerified(false);
      setReviewerPassword("");
      setReviewerPasswordOpen(true);
    },
    [email, reviewerUsers],
  );
  const handleReviewerPasswordCancel = () => {
    setReviewerPasswordOpen(false);
    setReviewerPassword("");
    setReviewerCandidate(null);
    setReviewerEmail("");
    setReviewerVerified(false);
  };
  const handleReviewerPasswordConfirm = async () => {
    if (!reviewerCandidate) {
      return;
    }
    setReviewerPasswordLoading(true);
    try {
      const ret = await api.userLogin({
        email: reviewerCandidate.email,
        password: reviewerPassword,
      });
      if (ret.code) {
        dispatch(
          pushNotification({
            type: "error",
            message: "notification_adminPassword_error_message",
            description: "",
          }),
        );
        return;
      }
      const updatedRecord = {
        ...printableRecord,
        reviewerName: reviewerCandidate.username,
      } as SampleRecordResponsePayload;
      setReviewerName(reviewerCandidate.username);
      setReviewerVerified(true);
      setPrintableRecord(updatedRecord);
      if (isElectronRuntime) {
        await api.updateSampleRecords(updatedRecord);
      }
      setReviewerPasswordOpen(false);
    } catch (error) {
      dispatch(
        pushNotification({
          type: "error",
          message: "notification_adminPassword_error_message",
          description: "",
        }),
      );
    } finally {
      setReviewerPasswordLoading(false);
      setReviewerPassword("");
    }
  };
  const printDescriptionItems: DescriptionsProps["items"] = useMemo(() => {
    const reviewerNode = (
      <Select
        placeholder={t("recordTable_printConfirmation_reviewerPlaceholder")}
        options={reviewerOptions}
        value={reviewerEmail || undefined}
        onChange={handleReviewerSelect}
        disabled={!reviewerOptions.length}
        style={{ minWidth: 220 }}
        data-testid="reviewer-select"
      />
    );
    return [
      {
        key: "1",
        label: t("recordTable_review_testerName"),
        children: username,
      },
      {
        key: "2",
        label: t("recordTable_review_reviewerName"),
        children: reviewerNode,
      },
    ];
  }, [
    reviewerOptions,
    handleReviewerSelect,
    reviewerEmail,
    reviewerName,
    t,
    username,
  ]);
  /* Build title before opening print confirmation. */
  const handleOpenPrintConfirmation = (record: SampleRecordResponsePayload) => {
    setPrintDescriptionTitle(
      record.slideFileName.concat(
        " - ",
        record.hospitalName,
        " - ",
        t("recordTable_printConfirmation_reportName_Ret"),
      ),
    );
    resetReviewerState();
    setPrintableRecord({
      ...record,
      reviewerName: "",
    });
    setPrintConfirmationOpen(true);
  };
  const handleCancelPrint = () => {
    setPrintConfirmationOpen(false);
    resetReviewerState();
  };
  const handleConfirmPrint = async () => {
    setPrintLoading(true);
    try {
      const [{ pdf }, { Doc }] = await Promise.all([
        import("@react-pdf/renderer"),
        import("../ReportPreviewer"),
      ]);
      const blob = await pdf(
        <Doc record={printableRecord} locale={"zh"} />,
      ).toBlob();
      const url = URL.createObjectURL(blob);
      if (pdfUrlRef.current) {
        URL.revokeObjectURL(pdfUrlRef.current);
      }
      pdfUrlRef.current = url;
      window.open(url, "_blank");
    } finally {
      setPrintLoading(false);
      setPrintableRecord({} as SampleRecordResponsePayload);
      setPrintConfirmationOpen(false);
      resetReviewerState();
    }
  };
  /* datasource */
  const dataSource = useSelector((state: RootState) => getRecordList(state));
  const visibleRecords = useMemo(
    () => filterVisibleRecords(dataSource, showDeletedOnly),
    [dataSource, showDeletedOnly],
  );
  const hasVisibleRecords = visibleRecords.length > 0;
  const totalRecords = useSelector((state: RootState) =>
    getTotalRecords(state),
  );
  const currentPage = useSelector((state: RootState) => getCurrentPage(state));
  const pageSize = useSelector((state: RootState) => getPageSize(state));
  useEffect(() => {
    return () => {
      if (pageChangeTimerRef.current) {
        clearTimeout(pageChangeTimerRef.current);
        pageChangeTimerRef.current = null;
      }
    };
  }, []);
  /*  fetch for first time rendering */
  useEffect(() => {
    if (!instituteName) {
      return;
    }
    dispatch(
      fetchSampleRecordAsync({
        page: currentPage,
        deletedOnly: showDeletedOnly,
        searchKeyword,
      }),
    );
  }, [dispatch, currentPage, showDeletedOnly, instituteName, searchKeyword]);
  /* column */
  const columns: ProColumns<SampleRecordResponsePayload>[] = [
    {
      title: t("recordTable_slideFileName"),
      dataIndex: "slideFileName",
      fixed: "left",
      key: "slideFileName",
      align: "left",
      width: 80,
      onHeaderCell: () => ({
        style: { textAlign: "left" },
      }),
      render: (text, record) => (
        <Typography.Text style={{ display: "block", textAlign: "left" }}>
          {record.slideFileName}
        </Typography.Text>
      ),
    },
    {
      title: t("recordTable_geneInfo_evaluationResult"),
      dataIndex: "result",
      key: "result",
      render: (text, record) => (
        <EvaluationResultTag
          result={record.result}
          modelType={record.modelType}
          deleted={Boolean(record.isDeleted)}
        />
      ),
      align: "center",
      width: 80,
    },
    {
      title: t("recordTable_geneInfo_testDate"),
      dataIndex: "testDate",
      key: "testDate",
      render: (text, record, index) => (
        <Typography.Text
          key={index}
          style={{ display: "block", textAlign: "center" }}
        >
          {record.testDate.substring(0, 10)}
        </Typography.Text>
      ),
      align: "center",
      width: 100,
      onHeaderCell: () => ({
        style: { textAlign: "center" },
      }),
      onCell: () => ({
        style: { textAlign: "center" },
      }),
    },
    {
      // title: t("recordTable_operation"),
      title: (
        <Flex justify="center">
          <Pagination
            size="small"
            simple
            align="end"
            current={currentPage}
            total={totalRecords}
            showSizeChanger={false}
            pageSize={pageSize}
            onChange={(page) => {
              if (page === currentPage) {
                return;
              }
              if (pageChangeTimerRef.current) {
                clearTimeout(pageChangeTimerRef.current);
              }
              pageChangeTimerRef.current = setTimeout(() => {
                dispatch(setCurrentPage(page));
                pageChangeTimerRef.current = null;
              }, 120);
            }}
          />
        </Flex>
      ),
      key: "option",
      valueType: "option",
      align: "center",
      fixed: "right",
      className: styles.noStrike,
      render: (text, record, index) => (
        <Flex justify="center" align="center">
          <>
            <Button
              key="print"
              size="small"
              color="default"
              variant="filled"
              data-testid={`record-print-${record.uuid}`}
              disabled={Boolean(record.isDeleted)}
              onClick={() => {
                handleOpenPrintConfirmation(record);
              }}
            >
              {t("recordTable_operation_print")}
            </Button>
            <Divider type="vertical" />
          </>
          <Button
            key="check"
            size="small"
            type="primary"
            className={styles.noStrike}
            data-testid={`record-check-${record.uuid}`}
            onClick={() => handleOpenSampleDetail(record)}
          >
            {t("recordTable_operation_check")}
          </Button>
        </Flex>
      ),
      width: 100,
    },
  ];
  // Threshold column (internal use)
  email.includes("villanelle.life") &&
    columns.push({
      title: t("recordTable_geneInfo_evaluationResult_threshold"),
      dataIndex: "result",
      key: "resultThreshold",
      render: (text, record, index) => (
        <Typography.Text>
          {Number.isFinite(parseFloat(record.result))
            ? parseFloat(record.result).toFixed(2)
            : record.result}
        </Typography.Text>
      ),
      align: "center",
      width: 80,
    });
  /* row operation */
  const selectedRowKeys = useSelector((state: RootState) =>
    getSelectedRowKeys(state),
  );
  const selectedRows = useSelector((state: RootState) =>
    getSelectedRows(state),
  );
  const handleUnselectRows = () => {
    dispatch(unselectRows());
  };
  const handleExportSelectedRows = async () => {
    console.log(selectedRows);
    const exportRows = selectedRows.map(({ isDeleted, uuid, ...rest }) => rest);
    if (isElectronRuntime) {
      try {
        const content = buildCsvContent(exportRows);
        const now = new Date();
        const pad2 = (value: number) => value.toString().padStart(2, "0");
        const stamp = `${now.getFullYear()}${pad2(now.getMonth() + 1)}${pad2(
          now.getDate(),
        )}_${pad2(now.getHours())}${pad2(now.getMinutes())}${pad2(
          now.getSeconds(),
        )}`;
        const result = await api.exportCsv({
          filename: `export_${stamp}.csv`,
          content,
        });
        if (!result.canceled) {
          dispatch(
            pushNotification({
              type: "success",
              message: "notification_export_success_message",
              description: "",
            }),
          );
        }
      } catch (error) {
        dispatch(
          pushNotification({
            type: "error",
            message: "notification_export_error_message",
            description: "",
          }),
        );
      }
      return;
    }
    try {
      objectArr2csv(exportRows);
    } catch (error) {
      console.error(error);
    }
  };
  const handleDeleteSelectedRows = () => {
    dispatch(
      deleteSampleRecordAsync({ selectedRows, deletedOnly: showDeletedOnly }),
    );
    setDeleteConfirmationOpen(false);
  };
  const rowSelectionOpItems: MenuProps["items"] = [
    {
      key: "2",
      label: t("recordTable_rowSelection_deleteSelectedRow"),
      onClick: () => setDeleteConfirmationOpen(true),
      danger: true,
    },
    {
      key: "1",
      label: t("recordTable_rowSelection_exportSelectedRow"),
      onClick: handleExportSelectedRows,
    },
    {
      key: "3",
      label: t("recordTable_rowSelection_cancelSelectedRow"),
      onClick: handleUnselectRows,
    },
  ];
  const renderTableFooter = useCallback(
    () => (
      <Row justify="space-between" align="middle">
        <Col span={8}>
          {!selectedRowKeys.length ? (
            <Space>
              <Button
                type={showDeletedOnly ? "primary" : "default"}
                icon={
                  showDeletedOnly ? <RollbackOutlined /> : <DeleteOutlined />
                }
                onClick={handleToggleDeletedView}
              >
                {showDeletedOnly
                  ? t("recordTable_toolbar_back")
                  : t("recordTable_toolbar_recycleBin")}
              </Button>
            </Space>
          ) : (
            <ConfigProvider wave={{ disabled: true }}>
              <Dropdown.Button
                placement="topRight"
                menu={{ items: rowSelectionOpItems }}
                trigger={["click"]}
              >
                {/* space is intentional */}
                {t("recordTable_rowSelection_selected")} {selectedRows.length}{" "}
                {t("recordTable_rowSelection_rowItems")}
              </Dropdown.Button>
            </ConfigProvider>
          )}
        </Col>
        <Col span={8}></Col>
        <Col span={8}>
          <Flex justify="flex-end">
            <Input.Search
              allowClear
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              onSearch={() => handleSearch(searchInput)}
              enterButton={<SearchOutlined />}
              placeholder={t("recordTable_search_placeholder")}
              style={{ width: 360 }}
            />
          </Flex>
        </Col>
      </Row>
    ),
    [
      handleSearch,
      handleToggleDeletedView,
      rowSelectionOpItems,
      searchInput,
      selectedRowKeys.length,
      selectedRows.length,
      showDeletedOnly,
      t,
    ],
  );
  return (
    <Flex vertical className={styles.container}>
      <ProTable
        size="small"
        actionRef={ref}
        dataSource={visibleRecords}
        columns={columns}
        rowKey="uuid"
        // showHeader={hasVisibleRecords}
        showHeader={true}
        rowSelection={
          hasVisibleRecords
            ? {
                selectedRowKeys: selectedRowKeys,
                // alwaysShowAlert: true,
                /* Fires when selection changes */
                onChange: (selectedRowKeys, selectedRows, type) => {
                  dispatch(
                    setSelectedRows({
                      page: currentPage,
                      rowKeys: selectedRowKeys,
                      rows: selectedRows,
                    }),
                  );
                },
                getCheckboxProps: (record) => ({
                  disabled: Boolean(record.isDeleted),
                }),
                // Custom selection options: https://ant.design/components/table-cn/#components-table-demo-row-selection-custom
                // Keep commented to hide the default selection menu
                // selections: [Table.SELECTION_ALL, Table.SELECTION_INVERT],
              }
            : undefined
        }
        rowClassName={(record) =>
          record.isDeleted ? `deleted-row ${styles.deletedRow}` : ""
        }
        tableAlertOptionRender={false}
        tableAlertRender={false}
        scroll={
          visibleRecords.length > 0
            ? {
                x: "max-content",
                y: scrollY,
              }
            : undefined
        }
        // footer={hasVisibleRecords ? renderTableFooter : undefined}
        footer={renderTableFooter}
        pagination={false}
        search={false}
        options={false}
        loading={tableLoading}
      />
      {/* description modal */}
      <DraggableModal
        title={descriptionTitle}
        centered
        width={"92%"}
        open={descriptionOpen}
        onCancel={handleCloseSampleDetail}
        footer={null}
        destroyOnHidden
        className={descriptionDeleted ? "description-deleted" : ""}
        styles={{ body: { maxHeight: "calc(100vh - 160px)", overflowY: "auto", padding: 16 } }}
      >
        <Row gutter={16}>
          <Col xs={24} lg={10}>
            <Flex vertical gap={8}>
              <Divider orientation="left" style={{ margin: "4px 0" }}>{t("recordTable_sampleSource")}</Divider>
              <Descriptions items={sampleSourceDescriptionItems} bordered layout="vertical" size="small" />
              <Divider orientation="left" style={{ margin: "4px 0" }}>{t("recordTable_geneInfo")}</Divider>
              <Descriptions items={geneInfoDescriptionItems} bordered layout="vertical" size="small" column={{ xs: 1, sm: 2 }} />
              <Divider orientation="left" style={{ margin: "4px 0" }}>{t("recordTable_review")}</Divider>
              <Descriptions items={reviewDescriptionItems} bordered layout="vertical" size="small" />
            </Flex>
          </Col>
          <Col xs={24} lg={14}>
            {detailUploadId ? (
              <Tabs
                defaultActiveKey="svs"
                size="small"
                style={{ height: "100%" }}
                tabBarStyle={{ margin: 0, padding: "0 12px", background: "#fafafa", borderRadius: "6px 6px 0 0", border: "1px solid #d9d9d9", borderBottom: 0 }}
                items={[
                  {
                    key: "svs",
                    label: "切片预览",
                    children: (
                      <div style={{ height: "calc(100vh - 240px)", minHeight: 480, borderRadius: "0 0 6px 6px", overflow: "hidden", border: "1px solid #d9d9d9", borderTop: 0 }}>
                        <SvsViewer uploadId={detailUploadId} />
                      </div>
                    ),
                  },
                  {
                    key: "heatmap",
                    label: "热力图",
                    children: (
                      <div style={{ height: "calc(100vh - 240px)", minHeight: 480, borderRadius: "0 0 6px 6px", overflow: "hidden", border: "1px solid #d9d9d9", borderTop: 0 }}>
                        <HeatmapOsdViewer
                          src={heatmapSrc}
                          loading={heatmapChecking || regeneratingHeatmap}
                          regenerating={regeneratingHeatmap}
                          onRegenerate={() => handleRegenerateHeatmap(detailRecord)}
                        />
                      </div>
                    ),
                  },
                ]}
              />
            ) : (
              <Flex align="center" justify="center" style={{ height: 200 }}>
                <Typography.Text type="secondary">切片预览加载中…</Typography.Text>
              </Flex>
            )}
          </Col>
        </Row>
      </DraggableModal>
      {/* delete confirmation modal */}
      <DraggableModal
        centered
        width={"30%"}
        open={deleteConfirmationOpen}
        closeIcon={false}
        closable={false}
        footer={[
          <Button
            key="cancelDelete"
            onClick={() => setDeleteConfirmationOpen(false)}
          >
            {t("recordTable_rowSelection_deleteSelectedRow_cancel")}
          </Button>,
          <Button
            danger
            type="primary"
            key="confirmDelete"
            onClick={handleDeleteSelectedRows}
          >
            {t("recordTable_rowSelection_deleteSelectedRow_confirm")}
          </Button>,
        ]}
        title={t("recordTable_rowSelection_deleteSelectedRow_title")}
        destroyOnHidden
      >
        {t("recordTable_rowSelection_deleteSelectedRow_description")}
      </DraggableModal>
      {/* print confirmation modal */}
      <DraggableModal
        centered
        width={"80%"}
        open={printConfirmationOpen}
        onCancel={handleCancelPrint}
        title={printDescriptionTitle}
        footer={null}
        destroyOnHidden
      >
        <div data-testid="print-confirmation-modal">
          <Descriptions bordered items={printDescriptionItems} />
        </div>
        <Form
          form={printConfirmationForm}
          autoComplete="off"
          {...confirmatioFormItemLayout}
          onFinish={handleConfirmPrint}
        >
          <Form.Item>
            <Form.Item
              name="printConfirmation_check"
              valuePropName="checked"
              noStyle
              rules={[
                {
                  required: true,
                  validator: (_, value: boolean) =>
                    value
                      ? Promise.resolve()
                      : Promise.reject(
                          new Error(
                            t("recordTable_printConfirmation_check_warning"),
                          ),
                        ),
                  message: t("recordTable_printConfirmation_check_warning"),
                },
              ]}
            >
              <Checkbox>
                <Typography.Text data-testid="print-confirmation-check">
                  {t("recordTable_printConfirmation_check")}
                </Typography.Text>
              </Checkbox>
            </Form.Item>
          </Form.Item>
          <Form.Item>
            <Button
              htmlType="submit"
              target="_blank"
              block
              type="primary"
              data-testid="print-confirm-submit"
              disabled={printLoading || !reviewerVerified}
              loading={printLoading}
            >
              {t("recordTable_printConfirmation_confirmPrint")}
            </Button>
          </Form.Item>
        </Form>
      </DraggableModal>
      <DraggableModal
        centered
        width={420}
        open={reviewerPasswordOpen}
        onCancel={handleReviewerPasswordCancel}
        title={t("recordTable_printConfirmation_reviewerPassword_title")}
        maskClosable={false}
        destroyOnHidden
        footer={[
          <Button
            key="reviewerPasswordCancel"
            type="default"
            onClick={handleReviewerPasswordCancel}
          >
            {t("newRecord_cancel")}
          </Button>,
          <Button
            key="reviewerPasswordConfirm"
            type="primary"
            onClick={handleReviewerPasswordConfirm}
            loading={reviewerPasswordLoading}
            disabled={!reviewerPassword || reviewerPasswordLoading}
            data-testid="reviewer-password-confirm"
          >
            {t("newRecord_confirm")}
          </Button>,
        ]}
      >
        <Input.Password
          data-testid="reviewer-password-input"
          value={reviewerPassword}
          onChange={(event) => setReviewerPassword(event.target.value)}
          placeholder={t(
            "recordTable_printConfirmation_reviewerPassword_placeholder",
          )}
          autoComplete="new-password"
        />
      </DraggableModal>
    </Flex>
  );
};
export default RecordTable;
