import { DeleteOutlined, SettingOutlined } from "@ant-design/icons";
import { Button, Flex, Form, Input, List, Tooltip, Typography } from "antd";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useDispatch, useSelector } from "react-redux";
import { ensureModelConfigLoaded, getModelConfigSnapshot } from "../../runtime/modelConfig";
import type { AppDispatch, RootState } from "../../store";
import {
  deleteUserAsync,
  fetchInstituteCredentialAsync,
  fetchUserListAsync,
  getInstituteCredentialToken,
  getUserList,
} from "../../store/admin";
import { getInstituteName, getUsername, getUserRole, userLogoutAsync } from "../../store/user";
import { UserRole } from "../../types";
import DraggableModal from "../DraggableModal";
const Settings = () => {
  const dispatch = useDispatch<AppDispatch>();
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const username = useSelector((state: RootState) => getUsername(state));
  const userRole = useSelector((state: RootState) => getUserRole(state));
  const instituteName = useSelector((state: RootState) => getInstituteName(state));
  const instituteCredentialToken = useSelector((state: RootState) => getInstituteCredentialToken(state));
  const [modelVersion, setModelVersion] = useState("LNM-1.0");
  const showModal = () => {
    void ensureModelConfigLoaded().then(() => {
      const snapshot = getModelConfigSnapshot();
      setModelVersion(snapshot.modelVersion);
    });
    setOpen(true);
  };
  const handleLogout = () => {
    dispatch(userLogoutAsync());
  };
  const handleCancel = () => {
    setOpen(false);
  };
  useEffect(() => {
    if (userRole !== UserRole.Administrator) {
      return;
    }
    dispatch(fetchUserListAsync({ instituteName }));
    dispatch(fetchInstituteCredentialAsync({ instituteName }));
  }, [dispatch, instituteName, userRole]);
  const userList = useSelector((state: RootState) => getUserList(state));
  const [userToDelete, setUserToDelete] = useState<string>("");
  const [deleteUserConfirmation, setDeleteUserConfirmation] = useState<boolean>(false);
  const handleOpenDeleteUserConfirmation = (uuid: string) => {
    setUserToDelete(uuid);
    setDeleteUserConfirmation(true);
  };
  const cancelDeleteUserConfirmation = () => {
    setDeleteUserConfirmation(false);
    setUserToDelete("");
  };
  const handleDeleteUser = () => {
    dispatch(deleteUserAsync(userToDelete));
    setDeleteUserConfirmation(false);
  };
  const formItemLayout = {
    labelCol: {
      xs: { span: 24 },
      sm: { span: 24 },
      md: { span: 24 },
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

  return (
    <>
      <Tooltip title={t("settings_title")}>
        <Button size="large" type="text" icon={<SettingOutlined />} onClick={showModal} />
      </Tooltip>
      <DraggableModal
        width={"56%"}
        open={open}
        onCancel={handleCancel}
        title={t("settings_title")}
        footer={false}
        centered
      >
        <Form {...formItemLayout} colon={false} autoComplete="off">
          <Form.Item label={t("settings_loginStatus_instituteName")} labelAlign="left">
            <Input disabled value={instituteName} />
          </Form.Item>
          <Form.Item label={t("settings_loginStatus_username")} labelAlign="left">
            <Input disabled value={username} />
          </Form.Item>
          <Form.Item label={t("settings_loginStatus_role")} labelAlign="left">
            <Input
              disabled
              value={
                userRole === UserRole.Administrator
                  ? t("settings_loginStatus_administrator")
                  : t("settings_loginStatus_operator")
              }
            />
          </Form.Item>
          <Form.Item label={t("settings_modelVersion")} labelAlign="left">
            <Input disabled value={modelVersion} />
          </Form.Item>
          {userRole === UserRole.Administrator && (
            <Form.Item
              label={t("settings_loginStatus_userManagement")}
              labelAlign="left"
              tooltip={t("settings_loginStatus_userManagement_tooltip")}
            >
              <Flex justify="space-between" style={{ marginTop: 4, marginBottom: 20 }} align="center">
                <Typography>{t("settings_token")}</Typography>
                <Typography.Text copyable>{instituteCredentialToken}</Typography.Text>
              </Flex>
              <div style={{ maxHeight: "200px", overflowY: "auto", marginBottom: "20px" }}>
                <List
                  dataSource={userList}
                  renderItem={(item) => {
                    const userName = item.username;
                    const role = item.userRole;
                    const userEmail = item.email;
                    const userUuid = item.uuid;
                    return (
                      <List.Item
                        style={{ paddingRight: 2, alignItems: "center", justifyContent: "space-between" }}
                        actions={[
                          <Button
                            key={`delete-${userUuid}`}
                            size="small"
                            type="text"
                            danger
                            disabled={role === UserRole.Administrator}
                            icon={<DeleteOutlined />}
                            onClick={() => handleOpenDeleteUserConfirmation(userUuid)}
                          />,
                        ]}
                      >
                        <List.Item.Meta
                          className="ant-list-item-meta-content"
                          title={userName}
                          description={
                            role === UserRole.Administrator
                              ? t("settings_loginStatus_administrator")
                              : t("settings_loginStatus_operator")
                          }
                        />
                        <Typography.Text>{userEmail}</Typography.Text>
                      </List.Item>
                    );
                  }}
                />
              </div>
            </Form.Item>
          )}
        </Form>
        <Button danger block onClick={handleLogout}>
          {t("settings_logout")}
        </Button>
      </DraggableModal>
      <DraggableModal
        width={400}
        title={t("settings_confirmDeleteUser_title")}
        open={deleteUserConfirmation}
        onCancel={cancelDeleteUserConfirmation}
        style={{ padding: 20 }}
        footer={[
          <Button key="cancelSubmit" type="default" onClick={cancelDeleteUserConfirmation}>
            {t("newRecord_cancel")}
          </Button>,
          <Button danger key="confirmSubmit" type="primary" onClick={handleDeleteUser}>
            {t("newRecord_confirm")}
          </Button>,
        ]}
        destroyOnHidden
        centered
      >
        {t("settings_confirmDeleteUser_content")}
      </DraggableModal>
    </>
  );
};
export default Settings;
