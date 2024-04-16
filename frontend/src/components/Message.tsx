import { memo, useState } from "react";
import { MessageDocument, Message as MessageType } from "../types";
import { str } from "../utils/str";
import { cn } from "../utils/cn";
import { ChevronDownIcon } from "@heroicons/react/24/outline";
import { LangSmithActions } from "./LangSmithActions";
import { DocumentList } from "./Document";
import { omit } from "lodash";
import { StringViewer } from "./String";

function tryJsonParse(value: string) {
  try {
    return JSON.parse(value);
  } catch (e) {
    return {};
  }
}

function Function(props: {
  call: boolean;
  name?: string;
  args?: string;
  open?: boolean;
  setOpen?: (open: boolean) => void;
}) {
  return (
    <>
      {props.call && (
        <span className="text-gray-900 whitespace-pre-wrap break-words mr-2">
          Use
        </span>
      )}
      {props.name && (
        <span className="inline-flex items-center rounded-md bg-gray-50 px-2 py-1 text-sm font-medium text-gray-600 ring-1 ring-inset ring-gray-500/10 relative -top-[1px] mr-2">
          {props.name}
        </span>
      )}
      {!props.call && props.setOpen && (
        <span
          className={cn(
            "inline-flex items-center rounded-md bg-gray-50 px-2 py-1 text-sm font-medium text-gray-600 ring-1 ring-inset ring-gray-500/10 cursor-pointer relative top-1",
            props.open && "mb-2",
          )}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            props.setOpen?.(!props.open);
          }}
        >
          <ChevronDownIcon
            className={cn("h-5 w-5 transition", props.open ? "rotate-180" : "")}
          />
        </span>
      )}
      {props.args && (
        <div className="text-gray-900 my-2 whitespace-pre-wrap break-words">
          <div className="ring-1 ring-gray-300 rounded">
            <table className="divide-y divide-gray-300">
              <tbody>
                {Object.entries(tryJsonParse(props.args)).map(
                  ([key, value], i) => (
                    <tr key={i}>
                      <td
                        className={cn(
                          i === 0 ? "" : "border-t border-transparent",
                          "py-1 px-3 table-cell text-sm border-r border-r-gray-300",
                        )}
                      >
                        <div className="font-medium text-gray-500">{key}</div>
                      </td>
                      <td
                        className={cn(
                          i === 0 ? "" : "border-t border-gray-200",
                          "py-1 px-3 table-cell",
                        )}
                      >
                        {str(value)}
                      </td>
                    </tr>
                  ),
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  );
}

function isDocumentContent(
  content: MessageType["content"],
): content is MessageDocument[] {
  return (
    Array.isArray(content) &&
    content.every((d) => typeof d === "object" && !!d && !!d.page_content)
  );
}

export function MessageContent(props: { content: MessageType["content"] }) {
  if (typeof props.content === "string") {
    return <StringViewer value={props.content} />;
  } else if (isDocumentContent(props.content)) {
    return <DocumentList documents={props.content} />;
  } else if (
    Array.isArray(props.content) &&
    props.content.every(
      (it) => typeof it === "object" && !!it && typeof it.content === "string",
    )
  ) {
    return (
      <DocumentList
        documents={props.content.map((it) => ({
          page_content: it.content,
          metadata: omit(it, "content"),
        }))}
      />
    );
  } else {
    return <div className="text-gray-900 prose">{str(props.content)}</div>;
  }
}

export const MessageViewer = memo(function (
  props: MessageType & { runId?: string },
) {
  const [open, setOpen] = useState(false);
  const contentIsDocuments =
    ["function", "tool"].includes(props.role) &&
    isDocumentContent(props.content);
  const showContent =
    ["function", "tool"].includes(props.role) && !contentIsDocuments
      ? open
      : true;
  return (
    <div className="flex flex-col mb-8">
      <div className="leading-6 flex flex-row">
        <div
          className={cn(
            "font-medium text-sm text-gray-400 uppercase mr-2 mt-1 w-28 flex flex-col",
            props.role === "function" && "mt-2",
          )}
        >
          {props.role}
        </div>
        <div className="flex-1">
          {["function", "tool"].includes(props.role) && (
            <Function
              call={false}
              name={props.name ?? props.additional_kwargs?.name}
              open={open}
              setOpen={contentIsDocuments ? undefined : setOpen}
            />
          )}
          {props.additional_kwargs?.function_call && (
            <Function
              call={true}
              name={props.additional_kwargs.function_call.name}
              args={props.additional_kwargs.function_call.arguments}
            />
          )}
          {props.additional_kwargs?.tool_calls
            ?.filter((call) => call.function)
            ?.map((call) => (
              <Function
                key={call.id}
                call={true}
                name={call.function?.name}
                args={call.function?.arguments}
              />
            ))}
          {showContent && <MessageContent content={props.content} />}
        </div>
      </div>
      {props.runId && (
        <div className="mt-2 pl-[120px]">
          <LangSmithActions runId={props.runId} />
        </div>
      )}
    </div>
  );
});
