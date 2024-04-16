import { useCallback, useState } from "react";
import { InformationCircleIcon } from "@heroicons/react/24/outline";
import { Chat } from "./components/Chat";
import { ChatList } from "./components/ChatList";
import { Layout } from "./components/Layout";
import { NewChat } from "./components/NewChat";
import { useChatList } from "./hooks/useChatList";
import { useSchemas } from "./hooks/useSchemas";
import { useStreamState } from "./hooks/useStreamState";
import {
  useConfigList,
  Config as ConfigInterface,
} from "./hooks/useConfigList";
import { Config } from "./components/Config";
import { MessageWithFiles } from "./utils/formTypes.ts";
import { useNavigate } from "react-router-dom";
import { useThreadAndAssistant } from "./hooks/useThreadAndAssistant.ts";
import { Message } from "./types.ts";

function App(props: { edit?: boolean }) {
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { chats, createChat, deleteChat } = useChatList();
  const { configs, saveConfig } = useConfigList();
  const { startStream, stopStream, stream } = useStreamState();
  const { configSchema, configDefaults } = useSchemas();

  const { currentChat, assistantConfig, isLoading } = useThreadAndAssistant();

  const startTurn = useCallback(
    async (message: MessageWithFiles | null, thread_id: string, assistantType: string) => {
      const files = message?.files || [];
      if (files.length > 0) {
        const formData = files.reduce((formData, file) => {
          formData.append("files", file);
          return formData;
        }, new FormData());
        formData.append(
          "config",
          JSON.stringify({ configurable: { thread_id } }),
        );
        await fetch(`/ingest`, {
          method: "POST",
          body: formData,
        });
      }

      let input: Message[] | Record<string, any> | null = null;

      if (message) {
        // Set the input to an array of messages. This is the default input
        // format for all assistant types.
        input = [
          {
            content: message.message,
            additional_kwargs: {},
            role: "human",
            example: false,
            id: `human-${Math.random()}`,
          },
        ]

        if (assistantType === "chat_retrieval") {
          // The RAG assistant type requires an object with a `messages` field.
          input = {
            messages: input,
          }
        }
      }

      await startStream(input, thread_id);
    },
    [startStream],
  );

  const startChat = useCallback(
    async (config: ConfigInterface, message: MessageWithFiles) => {
      const chat = await createChat(message.message, config.assistant_id);
      navigate(`/thread/${chat.thread_id}`);
      const assistantType = config.config.configurable?.type as string;
      return startTurn(message, chat.thread_id, assistantType);
    },
    [createChat, navigate, startTurn],
  );

  const selectChat = useCallback(
    async (id: string | null) => {
      if (currentChat) {
        stopStream?.(true);
      }
      if (!id) {
        const firstAssistant = configs?.[0]?.assistant_id ?? null;
        navigate(firstAssistant ? `/assistant/${firstAssistant}` : "/");
        window.scrollTo({ top: 0 });
      } else {
        navigate(`/thread/${id}`);
      }
      if (sidebarOpen) {
        setSidebarOpen(false);
      }
    },
    [currentChat, sidebarOpen, stopStream, configs, navigate],
  );

  const selectConfig = useCallback(
    (id: string | null) => {
      navigate(id ? `/assistant/${id}` : "/");
    },
    [navigate],
  );

  return (
    <Layout
      subtitle={
        assistantConfig ? (
          <span className="inline-flex gap-1 items-center">
            {assistantConfig.name}
            <InformationCircleIcon
              className="h-5 w-5 cursor-pointer text-indigo-600"
              onClick={() => {
                selectConfig(assistantConfig.assistant_id);
              }}
            />
          </span>
        ) : null
      }
      sidebarOpen={sidebarOpen}
      setSidebarOpen={setSidebarOpen}
      sidebar={
        <ChatList
          chats={chats}
          enterChat={selectChat}
          deleteChat={deleteChat}
          enterConfig={selectConfig}
        />
      }
    >
      {currentChat && assistantConfig && (
        <Chat startStream={startTurn} stopStream={stopStream} stream={stream} />
      )}
      {!currentChat && assistantConfig && !props.edit && (
        <NewChat
          startChat={startChat}
          configSchema={configSchema}
          configDefaults={configDefaults}
          configs={configs}
          saveConfig={saveConfig}
          enterConfig={selectConfig}
        />
      )}
      {!currentChat && assistantConfig && props.edit && (
        <Config
          className="mb-6"
          config={assistantConfig}
          configSchema={configSchema}
          configDefaults={configDefaults}
          saveConfig={saveConfig}
          enterConfig={selectConfig}
          edit={props.edit}
        />
      )}
      {!currentChat && !assistantConfig && !isLoading && (
        <Config
          className="mb-6"
          config={null}
          configSchema={configSchema}
          configDefaults={configDefaults}
          saveConfig={saveConfig}
          enterConfig={selectConfig}
        />
      )}
      {isLoading && <div>Loading...</div>}
    </Layout>
  );
}

export default App;
