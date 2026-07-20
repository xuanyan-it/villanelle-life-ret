import { LockOutlined } from "@ant-design/icons";
import type {
  StepsProps} from "antd";
import {
  Button,
  Divider,
  Flex,
  Form,
  Input,
  Steps,
  Tabs,
} from "antd";
import type { TabsProps } from "antd/lib";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useDispatch, useSelector } from "react-redux";
import { useLocation } from "react-router-dom";
import { api } from "../../api";
import { isElectronRuntime as detectElectronRuntime } from "../../platform/runtime";
import type { AppDispatch, RootState } from "../../store";
import {
  getInstituteName,
  getLoginStatus,
  userCreateAsync,
  userLoginAsync,
  verifyRegisterTokenAsync,
} from "../../store/user";
import { RequestStatus } from "../../types";
import { isValidEmail, isValidPassword } from "../../utils/formatHelper";
import DraggableModal from "../DraggableModal";
import {
  isBootstrapRegisterMode,
  resolveActiveLoginTabKey,
  resolveLoginTabAvailable,
  resolveRegisterUserRole,
  type RegisterMode,
} from "./loginPanel.logic";
import styles from "./login-panel.module.css";
const LoginPanel = () => {
  const isElectronRuntime = detectElectronRuntime();
  const [hasLocalUsers, setHasLocalUsers] = useState<boolean | undefined>(
    undefined
  );
  const [bootstrapCheckFailed, setBootstrapCheckFailed] = useState(false);
  const isFirstRun = isElectronRuntime && hasLocalUsers === false;
  const allowVestStep = !isElectronRuntime;
  const [activeTabKey, setActiveTabKey] = useState<string>("login");
  const [registerSubTabKey, setRegisterSubTabKey] = useState<string>("register_bootstrap");
  const location = useLocation();
  const [inputValue, setInputValue] = useState(""); // token from query string
  useEffect(() => {
    const queryParams = new URLSearchParams(location.search);
    const paramA = queryParams.get("a"); // read query param "a" from URL
    if (paramA) {
      setInputValue(paramA); // prefill token input on mount
    }
  }, [location.search]); // rerun when URL query changes
  useEffect(() => {
    if (!isElectronRuntime) {
      return;
    }
    let isActive = true;
    api
      .isBootstrapRequired()
      .then((bootstrapRequired) => {
        if (isActive) {
          setHasLocalUsers(!bootstrapRequired);
          setBootstrapCheckFailed(false);
        }
      })
      .catch(() => {
        if (isActive) {
          setHasLocalUsers(undefined);
          setBootstrapCheckFailed(true);
        }
      });
    return () => {
      isActive = false;
    };
  }, [isElectronRuntime]);
  useEffect(() => {
    if (!isElectronRuntime) {
      return;
    }
    if (hasLocalUsers === false) {
      setActiveTabKey("register");
      return;
    }
    if (hasLocalUsers === true) {
      setActiveTabKey("login");
    }
  }, [hasLocalUsers, isElectronRuntime]);
  const { t } = useTranslation();
  const dispatch = useDispatch<AppDispatch>();
  const isLoggedIn = useSelector(
    (state: RootState) => getLoginStatus(state) === RequestStatus.Success
  );
  const loading = useSelector(
    (state: RootState) => getLoginStatus(state) === RequestStatus.Pending
  );
  const instituteName = useSelector((state: RootState) =>
    getInstituteName(state)
  );
  const formItemLayout = {
    labelCol: {
      xs: { span: 24 },
      sm: { span: 24 },
      md: { span: 24 },
      lg: { span: 24 },
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
  type LoginField = {
    login_email: string;
    login_password: string;
  };
  const handleLogin = async (value: LoginField) => {
    dispatch(
      userLoginAsync({
        email: value.login_email,
        password: value.login_password,
      })
    );
  };
  const LoginCredentialForm = () => {
    return (
      <Form
        name="login"
        autoComplete="off"
        initialValues={{
          login_email: inputValue,
        }}
        onFinish={handleLogin}
        {...formItemLayout}
      >
        <Form.Item
          name="login_email"
          label={t("loginPanel_login_email")}
          labelAlign="left"
          rules={[
            { required: true, message: t("loginPanel_login_email_warning") },
            { max: 30, message: t("loginPanel_login_email_warning_max") },
            ({ getFieldValue }) => ({
              validator(_, value: string) {
                if (!value || isValidEmail(getFieldValue("login_email"))) {
                  return Promise.resolve();
                }
                return Promise.reject(
                  new Error(t("loginPanel_login_email_warning"))
                );
              },
            }),
          ]}
          
        >
          <Input allowClear maxLength={30} autoComplete="off" data-testid="login-email-input" />
        </Form.Item>
        <Form.Item
          name="login_password"
          label={t("loginPanel_login_password")}
          labelAlign="left"
          rules={[
            { required: true, message: t("loginPanel_login_password_warning") },
            ({ getFieldValue }) => ({
              validator(_, value: string) {
                if (
                  !value ||
                  isValidPassword(getFieldValue("login_password"))
                ) {
                  return Promise.resolve();
                }
                return Promise.reject(
                  new Error(t("loginPanel_login_password_warning"))
                );
              },
            }),
          ]}
          
        >
          <Input.Password
            allowClear
            prefix={<LockOutlined />}
            type="password"
            maxLength={16}
            autoComplete="new-password"
            data-testid="login-password-input"
          />
        </Form.Item>
        <Form.Item>
          <Button
            block
            type="primary"
            htmlType="submit"
            loading={loading}
            data-testid="login-submit"
          >
            {t("loginPanel_login_submit")}
          </Button>
        </Form.Item>
      </Form>
    );
  };
  const [vestCredentialFormRef] = Form.useForm();
  const [registerCredentialFormRef] = Form.useForm();
  const [currentStep, setCurrentStep] = useState<number>(0);
  const handleVest = async (value: any) => {
    if (!allowVestStep) {
      return;
    }
    try {
      await dispatch(
        verifyRegisterTokenAsync({
          token: value["vest_token"],
        })
      ).unwrap();
      setCurrentStep(1);
    } catch (error) {}
  };
  useEffect(() => {
    if (allowVestStep && instituteName) {
      registerCredentialFormRef.setFieldsValue({
        register_instituteName: instituteName,
      });
    }
  }, [allowVestStep, instituteName, registerCredentialFormRef]);
  const VestCredentialForm = () => {
    if (!allowVestStep) {
      return null;
    }
    return (
      <Form
        form={vestCredentialFormRef}
        name="vest"
        autoComplete="off"
        initialValues={{
          vest_token: "",
        }}
        {...formItemLayout}
        onFinish={handleVest}
        style={{ marginTop: 20 }}
        colon={false}
      >
        <Form.Item
          name="vest_token"
          label={t("loginPanel_vest_token")}
          labelAlign="left"
          rules={[
            {
              required: true,
              message: t("loginPanel_vest_token_warning_empty"),
            },
          ]}
        >
          <Input
            allowClear
            placeholder={t("loginPanel_vest_token_placeholder")}
            autoComplete="off"
          />
        </Form.Item>
        <Form.Item>
          <Flex justify="flex-end">
            <Divider type="vertical" style={{ alignSelf: "center" }} />
            <Button type="primary" htmlType="submit" loading={loading}>
              {t("loginPanel_vest_verify")}
            </Button>
          </Flex>
        </Form.Item>
      </Form>
    );
  };
  type RegisterCredentials = {
    register_email: string;
    register_password: string;
    register_password_confirm: string;
    register_instituteName: string;
    register_username: string;
  };
  const handleRegister = async (value: RegisterCredentials, mode: RegisterMode) => {
    const isBootstrap = isBootstrapRegisterMode(mode, isFirstRun);
    const targetRole = resolveRegisterUserRole({
      mode,
      isFirstRun,
    });
    dispatch(
      userCreateAsync({
        email: value.register_email,
        username: value.register_username,
        password: value.register_password,
        instituteName: value.register_instituteName,
        userRole: targetRole,
        bootstrap: isBootstrap,
      })
    );
  };
  const RegisterCredentialForm = ({ mode }: { mode: RegisterMode }) => {
    const isBootstrap = isBootstrapRegisterMode(mode, isFirstRun);
    const isInvited = mode === "invited" || (mode === "electron" && !isFirstRun);
    return (
      <Form
        form={registerCredentialFormRef}
        name="register"
        autoComplete="off"
        initialValues={{
          register_email: "",
          register_password: "",
          register_password_confirm: "",
          register_username: "",
        }}
        onFinish={(value) => handleRegister(value, mode)}
        colon={false}
        {...formItemLayout}
        style={{ marginTop: 20 }}
      >
        <Form.Item
          name="register_instituteName"
          label={t("loginPanel_register_instituteName")}
          labelAlign="left"
          rules={
            isBootstrap
              ? [
                  {
                    required: true,
                    message: t("loginPanel_register_instituteName_warning"),
                  },
                  {
                    max: 40,
                    message: t("loginPanel_register_instituteName_warning_max"),
                  },
                ]
              : undefined
          }
        >
          {isBootstrap ? (
            <Input
              allowClear
              placeholder={t("loginPanel_register_instituteName_placeholder")}
              maxLength={40}
              autoComplete="off"
              data-testid="register-institute-name-input"
            />
          ) : (
            <Input disabled value={instituteName} />
          )}
        </Form.Item>
        <Form.Item
          name="register_username"
          label={
            isBootstrap
              ? t("loginPanel_register_adminName")
              : t("loginPanel_register_operatorName")
          }
          labelAlign="left"
          rules={[
            {
              required: true,
              message: t("loginPanel_register_username_warning"),
            },
            {
              max: 8,
              message: t("loginPanel_register_username_warning_max"),
            },
          ]}
          
        >
          <Input
            allowClear
            placeholder={t("loginPanel_register_username_placeholder")}
            maxLength={8}
            autoComplete="off"
            data-testid="register-username-input"
          />
        </Form.Item>
        <Form.Item
          name="register_email"
          label={
            isBootstrap
              ? t("loginPanel_register_adminEmail")
              : t("loginPanel_register_operatorEmail")
          }
          labelAlign="left"
          rules={[
            {
              required: true,
              message: t("loginPanel_register_email_warning"),
            },
            { max: 30, message: t("loginPanel_register_email_warning_max") },
            ({ getFieldValue }) => ({
              validator(_, value: string) {
                if (!value || isValidEmail(getFieldValue("register_email"))) {
                  return Promise.resolve();
                }
                return Promise.reject(
                  new Error(t("loginPanel_register_email_warning"))
                );
              },
            }),
          ]}
          
        >
          <Input
            allowClear
            placeholder={
              isBootstrap
                ? t("loginPanel_register_adminEmail_placeholder")
                : t("loginPanel_register_operatorEmail_placeholder")
            }
            maxLength={30}
            autoComplete="off"
            data-testid="register-email-input"
          />
        </Form.Item>
        <Form.Item
          name="register_password"
          label={
            isBootstrap
              ? t("loginPanel_register_adminPassword")
              : t("loginPanel_register_operatorPassword")
          }
          labelAlign="left"
          tooltip={
            isBootstrap
              ? t("loginPanel_register_adminPassword_tooltip")
              : t("loginPanel_register_operatorPassword_tooltip")
          }
          rules={[
            {
              required: true,
              message: t("loginPanel_register_password_warning"),
            },
            ({ getFieldValue }) => ({
              validator(_, value: string) {
                if (
                  !value ||
                  isValidPassword(getFieldValue("register_password"))
                ) {
                  return Promise.resolve();
                }
                return Promise.reject(
                  new Error(t("loginPanel_register_password_warning"))
                );
              },
            }),
          ]}
          normalize={(value) =>
            typeof value === "string" ? value.slice(0, 16) : value
          }
          
        >
          <Input.Password
            allowClear
            prefix={<LockOutlined />}
            type="password"
            maxLength={16}
            autoComplete="new-password"
            data-testid="register-password-input"
          />
        </Form.Item>
        <Form.Item
          name="register_passwordConfirm"
          label={
            isBootstrap
              ? t("loginPanel_register_adminPasswordConfirm")
              : t("loginPanel_register_operatorPasswordConfirm")
          }
          labelAlign="left"
          dependencies={["register_password"]}
          rules={[
            {
              required: true,
              message: t("loginPanel_register_passwordConfirm_warning"),
            },
            ({ getFieldValue }) => ({
              validator(_, value: string) {
                if (!value || getFieldValue("register_password") === value) {
                  return Promise.resolve();
                }
                return Promise.reject(
                  new Error(t("loginPanel_register_passwordConfirm_warning"))
                );
              },
            }),
          ]}
          normalize={(value) =>
            typeof value === "string" ? value.slice(0, 16) : value
          }
          
        >
          <Input.Password
            allowClear
            prefix={<LockOutlined />}
            type="password"
            maxLength={16}
            autoComplete="new-password"
            data-testid="register-password-confirm-input"
          />
        </Form.Item>
        <Form.Item>
          <Flex justify="flex-end" align="center">
            {allowVestStep && isInvited && currentStep > 0 && (
              <>
                <Button onClick={() => setCurrentStep(0)}>
                  {t("loginPanel_register_previous")}
                </Button>
                <Divider type="vertical" style={{ alignSelf: "center" }} />
              </>
            )}
            <Button
              type="primary"
              htmlType="submit"
              loading={loading}
              data-testid="register-submit"
            >
              {t("loginPanel_register_submit")}
            </Button>
          </Flex>
        </Form.Item>
      </Form>
    );
  };
  const registerStepsContent = [
    ...(allowVestStep
      ? [
          {
            key: t("loginPanel_register_steps_vest"),
            content: <VestCredentialForm />,
          },
          {
            key: t("loginPanel_register_steps_register"),
            content: <RegisterCredentialForm mode="invited" />,
          },
        ]
      : [
          {
            key: t("loginPanel_register_steps_register"),
            content: <RegisterCredentialForm mode="electron" />,
          },
        ]),
  ];
  const registerStepsItem: StepsProps["items"] = Object.values(
    registerStepsContent
  ).map((item) => ({
    key: item.key,
    title: item.key,
  }));
  const loginTabAvailable = resolveLoginTabAvailable(
    isElectronRuntime,
    hasLocalUsers,
    bootstrapCheckFailed
  );
  const registerInvitedContent = (
    <>
      {allowVestStep && (
        <Steps
          size="small"
          labelPlacement="vertical"
          current={currentStep}
          items={registerStepsItem}
          style={{ marginTop: 20 }}
        />
      )}
      {registerStepsContent[currentStep]?.content ||
        registerStepsContent[0].content}
    </>
  );
  const LoginPanelTabItems: TabsProps["items"] = [
    ...(loginTabAvailable
      ? [
          {
            key: "login",
            label: t("loginPanel_tabs_login"),
            children: <LoginCredentialForm />,
          },
        ]
      : []),
    ...(!isElectronRuntime
      ? [
          {
            key: "register",
            label: t("loginPanel_tabs_register"),
            children: (
              <Tabs
                className={styles.subTabs}
                activeKey={registerSubTabKey}
                onChange={(key) => {
                  setRegisterSubTabKey(key);
                  if (key !== "register_invited") {
                    setCurrentStep(0);
                  }
                }}
                items={[
                  {
                    key: "register_bootstrap",
                    label: t("loginPanel_tabs_adminRegister"),
                    children: <RegisterCredentialForm mode="bootstrap" />,
                  },
                  {
                    key: "register_invited",
                    label: t("loginPanel_tabs_invitedRegister"),
                    children: registerInvitedContent,
                  },
                ]}
              />
            ),
          },
        ]
      : [
          {
            key: "register",
            label: isFirstRun
              ? t("loginPanel_tabs_adminRegister")
              : t("loginPanel_tabs_invitedRegister"),
            children: isFirstRun ? (
              <RegisterCredentialForm mode="electron" />
            ) : (
              registerInvitedContent
            ),
          },
        ]),
  ];
  return (
    <DraggableModal
      cancelButtonProps={{ disabled: true }}
      open={!isLoggedIn}
      centered
      closable={false}
      destroyOnHidden={true}
      footer={null}
    >
      {(() => {
        if (bootstrapCheckFailed) {
          return (
            <div data-testid="bootstrap-check-error">
              Unable to verify local user state. Please check local database status.
            </div>
          );
        }
        const resolvedActiveKey = resolveActiveLoginTabKey(
          activeTabKey,
          isElectronRuntime,
          hasLocalUsers,
          bootstrapCheckFailed
        );
        return (
      <Tabs
        className={styles.rootTabs}
        activeKey={resolvedActiveKey}
        onChange={(key) => {
          setActiveTabKey(key);
          if (key !== "register") {
            setCurrentStep(0);
          }
        }}
        items={LoginPanelTabItems}
      />
        );
      })()}
    </DraggableModal>
  );
};
export default LoginPanel;
