import { useEffect, useState, useRef } from "react";
import type { EventRegistration } from "../../api/eventRegistration";
import {
  IconPencil,
  IconTrash,
  IconCheck,
  IconX,
  IconUser,
  IconUsersCircle,
  IconChevronDown,
  IconChevronRight,
} from "../icons";
import { useEventumSlug } from "../../hooks/useEventumSlug";
import { useAdminData } from "../../contexts/AdminDataContext";
import {
  resolveParticipantGroupIds,
  participantsToIdMap,
  type ParticipantGroupResolveOptions,
} from "../../utils/resolveParticipantGroup";
import type { Participant } from "../../types";

export type RegistrationCardMode = "view" | "edit";

export type RegistrationCardGroup = { id: number; name: string };

export type RegistrationCardSavePayload = {
  event_id: number;
  registration_type: "button" | "application";
  max_participants?: number | null;
  allowed_group?: number | null;
};

export interface RegistrationCardProps {
  registration: EventRegistration;
  mode: RegistrationCardMode;
  onStartEdit: () => void;
  onDelete: () => void;
  onSave: (data: RegistrationCardSavePayload) => void;
  onCancel: () => void;
  groups: RegistrationCardGroup[];
  /** Подпись мероприятия в шапке (например, несохранённое имя из формы редактирования события). */
  displayEventName?: string | null;
}

const RegistrationCard: React.FC<RegistrationCardProps> = ({
  registration,
  mode,
  onStartEdit,
  onDelete,
  onSave,
  onCancel,
  groups,
  displayEventName,
}) => {
  const eventumSlug = useEventumSlug();
  const {
    participants: adminParticipants,
    participantGroups,
    groupStructureRaw,
  } = useAdminData();
  const [registrationType, setRegistrationType] = useState<"button" | "application">(
    registration.registration_type
  );
  const [maxParticipants, setMaxParticipants] = useState<string>(
    registration.max_participants?.toString() || ""
  );
  const [allowedGroupId, setAllowedGroupId] = useState<string>(
    registration.allowed_group?.toString() || ""
  );
  const [isParticipantsExpanded, setIsParticipantsExpanded] = useState(false);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [isLoadingParticipants, setIsLoadingParticipants] = useState(false);
  const [isEventParticipantsExpanded, setIsEventParticipantsExpanded] = useState(false);
  const [eventParticipants, setEventParticipants] = useState<Participant[]>([]);
  const [isLoadingEventParticipants, setIsLoadingEventParticipants] = useState(false);

  const eventTitle =
    (displayEventName != null && displayEventName !== ""
      ? displayEventName
      : registration.event.name) || registration.event.name;

  useEffect(() => {
    setRegistrationType(registration.registration_type);
    setMaxParticipants(registration.max_participants?.toString() || "");
    setAllowedGroupId(registration.allowed_group?.toString() || "");
    setIsParticipantsExpanded(false);
    setParticipants([]);
    setIsEventParticipantsExpanded(false);
    setEventParticipants([]);
  }, [registration]);

  const loadParticipants = async () => {
    if (!eventumSlug || !registration.applicants || registration.applicants.length === 0) {
      return;
    }

    setIsLoadingParticipants(true);
    try {
      const byId = new Map(adminParticipants.map((p) => [p.id, p]));
      const participantsData = registration.applicants
        .map((id) => byId.get(id))
        .filter((p): p is Participant => p != null);
      setParticipants(participantsData);
    } catch (error) {
      console.error("Error loading participants:", error);
    } finally {
      setIsLoadingParticipants(false);
    }
  };

  const handleToggleParticipants = () => {
    if (
      !isParticipantsExpanded &&
      participants.length === 0 &&
      registration.applicants &&
      registration.applicants.length > 0
    ) {
      loadParticipants();
    }
    setIsParticipantsExpanded(!isParticipantsExpanded);
  };

  const loadEventParticipants = async () => {
    if (!eventumSlug || !registration.event.id) {
      return;
    }

    setIsLoadingEventParticipants(true);
    try {
      const eventGroupId = (registration.event as { event_group_id?: number | null })
        .event_group_id;

      let groupIds: number[] = [];

      if (eventGroupId) {
        groupIds = [eventGroupId];
      } else if (groupStructureRaw) {
        groupIds = groupStructureRaw.event_relations
          .filter((er) => er.event_id === registration.event.id)
          .map((er) => er.group_id);
      }

      if (groupIds.length === 0) {
        setEventParticipants([]);
        return;
      }

      const eventGroups = participantGroups.filter((group) => group && groupIds.includes(group.id));

      if (eventGroups.length === 0) {
        setEventParticipants([]);
        return;
      }

      const opts: ParticipantGroupResolveOptions = {
        resolveGroup: (id) => participantGroups.find((g) => g.id === id) ?? null,
        allParticipantIds: new Set(adminParticipants.map((p) => p.id)),
      };
      const merged = new Set<number>();
      for (const g of eventGroups) {
        for (const id of resolveParticipantGroupIds(g, opts)) {
          merged.add(id);
        }
      }

      if (merged.size === 0) {
        setEventParticipants([]);
        return;
      }

      const byId = participantsToIdMap(adminParticipants);
      const participantsData = Array.from(merged)
        .sort((a, b) => a - b)
        .map((id) => byId.get(id))
        .filter((p): p is Participant => p != null);
      setEventParticipants(participantsData);
    } catch (error) {
      console.error("Error loading event participants:", error);
      setEventParticipants([]);
    } finally {
      setIsLoadingEventParticipants(false);
    }
  };

  const handleToggleEventParticipants = () => {
    const willExpand = !isEventParticipantsExpanded;
    if (willExpand && eventParticipants.length === 0 && !isLoadingEventParticipants) {
      loadEventParticipants();
    }
    setIsEventParticipantsExpanded(willExpand);
  };

  const capacityInfo = (max?: number | null) => {
    if (max == null) return "без лимита";
    return `максимум ${max}`;
  };

  const registrationTypeLabel = {
    button: "Запись по кнопке",
    application: "По заявкам",
  };

  const allowedGroup = groups.find((g) => g.id === registration.allowed_group);

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm sm:p-6">
      <div className="space-y-3">
        {mode === "edit" ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-base font-semibold text-gray-900">{eventTitle}</h4>
              <button
                type="button"
                onClick={onDelete}
                className="p-2 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                title="Удалить"
              >
                <IconTrash size={16} />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Тип регистрации</label>
                <select
                  value={registrationType}
                  onChange={(e) => setRegistrationType(e.target.value as "button" | "application")}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                >
                  <option value="button">Запись по кнопке</option>
                  <option value="application">По заявкам</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Максимальное количество участников
                </label>
                <input
                  type="number"
                  value={maxParticipants}
                  onChange={(e) => setMaxParticipants(e.target.value)}
                  placeholder="Без лимита"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Доступно для (опционально)
                </label>
                <GroupCombobox groups={groups} value={allowedGroupId} onChange={setAllowedGroupId} />
              </div>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1">
              <h4 className="text-base font-semibold text-gray-900">{eventTitle}</h4>
              <div className="text-sm text-gray-500 space-y-1">
                <div>
                  <span className="text-gray-500">Тип:</span>{" "}
                  <span className="font-medium text-gray-900">
                    {registrationTypeLabel[registration.registration_type]}
                  </span>
                </div>
                <div>
                  <span className="text-gray-500">Места:</span>{" "}
                  <span className="font-medium text-gray-900">{capacityInfo(registration.max_participants)}</span>
                </div>
                <div>
                  <span className="text-gray-500">Подано заявок:</span>{" "}
                  <span className="font-medium text-gray-900">{registration.registered_count}</span>
                </div>
                <div>
                  <span className="text-gray-500">Свободно мест:</span>{" "}
                  <span className="font-medium text-gray-900">
                    {registration.max_participants != null
                      ? Math.max(0, registration.max_participants - (registration.event.participants_count || 0))
                      : "без лимита"}
                  </span>
                </div>
                <div>
                  <span className="text-gray-500">Доступно для:</span>{" "}
                  <span className="font-medium text-gray-900">{allowedGroup ? allowedGroup.name : "всех"}</span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {registration.registration_type === "application" &&
                registration.applicants &&
                registration.applicants.length > 0 && (
                  <button
                    type="button"
                    onClick={handleToggleParticipants}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition-colors"
                    title="Показать участников, подавших заявку"
                  >
                    <IconUser size={16} />
                    <span>{registration.applicants.length}</span>
                    {isParticipantsExpanded ? (
                      <IconChevronDown size={14} className="transition-transform" />
                    ) : (
                      <IconChevronRight size={14} className="transition-transform" />
                    )}
                  </button>
                )}
              <button
                type="button"
                onClick={handleToggleEventParticipants}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm text-blue-600 hover:text-blue-900 hover:bg-blue-50 transition-colors"
                title="Показать участников мероприятия"
              >
                <IconUsersCircle size={16} />
                {registration.event_participants_count !== undefined &&
                  registration.event_participants_count > 0 && (
                    <span>{registration.event_participants_count}</span>
                  )}
                {isEventParticipantsExpanded ? (
                  <IconChevronDown size={14} className="transition-transform" />
                ) : (
                  <IconChevronRight size={14} className="transition-transform" />
                )}
              </button>
              <button
                type="button"
                onClick={onStartEdit}
                className="p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
                title="Редактировать"
              >
                <IconPencil size={16} />
              </button>
            </div>
          </div>
        )}

        {mode !== "edit" && isParticipantsExpanded && registration.registration_type === "application" && (
          <div className="border-t pt-3 mt-3">
            {isLoadingParticipants ? (
              <div className="text-center py-4 text-sm text-gray-500">Загрузка участников...</div>
            ) : participants.length === 0 ? (
              <div className="text-center py-4 text-sm text-gray-500">Участники не найдены</div>
            ) : (
              <div className="space-y-2">
                <div className="text-sm font-medium text-gray-700 mb-2">
                  Участники, подавшие заявку ({participants.length}):
                </div>
                <div className="space-y-1.5 max-h-60 overflow-y-auto">
                  {participants.map((participant) => (
                    <div
                      key={participant.id}
                      className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors"
                    >
                      <IconUser size={16} className="text-gray-400" />
                      <span className="text-sm text-gray-900">{participant.name}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {mode !== "edit" && isEventParticipantsExpanded && (
          <div className="border-t pt-3 mt-3">
            {isLoadingEventParticipants ? (
              <div className="text-center py-4 text-sm text-gray-500">Загрузка участников...</div>
            ) : eventParticipants.length === 0 ? (
              <div className="text-center py-4 text-sm text-gray-500">
                Участники не найдены. Проверьте, что группы связаны с мероприятием и содержат участников.
              </div>
            ) : (
              <div className="space-y-2">
                <div className="text-sm font-medium text-gray-700 mb-2">
                  Участники мероприятия ({eventParticipants.length}):
                </div>
                <div className="space-y-1.5 max-h-60 overflow-y-auto">
                  {eventParticipants.map((participant) => (
                    <div
                      key={participant.id}
                      className="flex items-center gap-2 px-3 py-2 rounded-lg bg-blue-50 hover:bg-blue-100 transition-colors"
                    >
                      <IconUsersCircle size={16} className="text-blue-400" />
                      <span className="text-sm text-gray-900">{participant.name}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {mode === "edit" && (
          <div className="border-t pt-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => {
                  onSave({
                    event_id: registration.event.id,
                    registration_type: registrationType,
                    max_participants: maxParticipants ? parseInt(maxParticipants, 10) : null,
                    allowed_group: allowedGroupId ? parseInt(allowedGroupId, 10) : null,
                  });
                }}
                className="inline-flex items-center justify-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
              >
                <IconCheck size={16} className="mr-2" />
                Сохранить
              </button>
              <button
                type="button"
                onClick={onCancel}
                className="inline-flex items-center justify-center rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-2"
              >
                <IconX size={16} className="mr-2" />
                Отмена
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

interface GroupComboboxProps {
  groups: RegistrationCardGroup[];
  value: string;
  onChange: (groupId: string) => void;
  placeholder?: string;
  emptyOptionLabel?: string;
}

export const GroupCombobox: React.FC<GroupComboboxProps> = ({
  groups,
  value,
  onChange,
  placeholder = "Введите название группы для поиска...",
  emptyOptionLabel = "Все участники",
}) => {
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState<number>(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const selectedGroup = groups.find((g) => g.id === parseInt(value, 10));

  const filteredGroups = groups.filter((group) =>
    group.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        if (selectedGroup) {
          setSearchQuery(selectedGroup.name);
        } else {
          setSearchQuery("");
        }
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [selectedGroup]);

  useEffect(() => {
    if (selectedGroup) {
      setSearchQuery(selectedGroup.name);
    } else if (!value) {
      setSearchQuery("");
    }
  }, [selectedGroup, value]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const query = e.target.value;
    setSearchQuery(query);
    setIsOpen(true);
    setHighlightedIndex(-1);
    if (!query && value) {
      onChange("");
    }
  };

  const handleSelectGroup = (group: RegistrationCardGroup | null) => {
    if (group) {
      onChange(group.id.toString());
      setSearchQuery(group.name);
    } else {
      onChange("");
      setSearchQuery("");
    }
    setIsOpen(false);
    setHighlightedIndex(-1);
  };

  const handleInputFocus = () => {
    setIsOpen(true);
    if (!searchQuery && !value) {
      setSearchQuery("");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    const allOptions = [{ id: 0, name: emptyOptionLabel }, ...filteredGroups];

    if (!isOpen && (e.key === "ArrowDown" || e.key === "Enter")) {
      setIsOpen(true);
      return;
    }

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev < allOptions.length - 1 ? prev + 1 : prev));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev > -1 ? prev - 1 : -1));
    } else if (e.key === "Enter" && highlightedIndex >= 0) {
      e.preventDefault();
      if (highlightedIndex === 0) {
        handleSelectGroup(null);
      } else {
        handleSelectGroup(allOptions[highlightedIndex]);
      }
    } else if (e.key === "Escape") {
      setIsOpen(false);
      inputRef.current?.blur();
    }
  };

  useEffect(() => {
    if (highlightedIndex >= 0 && listRef.current) {
      const highlightedElement = listRef.current.children[highlightedIndex] as HTMLElement;
      if (highlightedElement) {
        highlightedElement.scrollIntoView({ block: "nearest" });
      }
    }
  }, [highlightedIndex]);

  const allOptions = [{ id: 0, name: emptyOptionLabel }, ...filteredGroups];

  return (
    <div ref={containerRef} className="relative">
      <input
        ref={inputRef}
        type="text"
        value={searchQuery}
        onChange={handleInputChange}
        onFocus={handleInputFocus}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
      />
      {isOpen && (
        <div className="absolute z-50 mt-1 w-full rounded-lg border border-gray-200 bg-white shadow-lg max-h-60 overflow-auto">
          {filteredGroups.length === 0 && searchQuery ? (
            <div className="px-3 py-2 text-sm text-gray-500">Группы не найдены</div>
          ) : (
            <>
              {filteredGroups.length < groups.length && searchQuery && (
                <div className="px-3 py-2 text-xs text-gray-500 border-b border-gray-100">
                  Найдено: {filteredGroups.length} из {groups.length}
                </div>
              )}
              <div ref={listRef} className="py-1">
                {allOptions.map((option, index) => {
                  const isSelected = index === 0 ? !value : parseInt(value, 10) === option.id;
                  return (
                    <button
                      key={option.id || "empty"}
                      type="button"
                      onClick={() => (index === 0 ? handleSelectGroup(null) : handleSelectGroup(option))}
                      className={`w-full text-left px-3 py-2 text-sm hover:bg-blue-50 focus:bg-blue-50 focus:outline-none ${
                        index === highlightedIndex ? "bg-blue-50" : ""
                      } ${isSelected ? "font-semibold text-blue-600" : "text-gray-700"}`}
                    >
                      {option.name}
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default RegistrationCard;
