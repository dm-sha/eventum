import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { IconX, IconUser, IconSearch, IconCheck, IconPencil, IconPlus } from "../icons";
import type { Event, Participant, ParticipantGroup, User } from "../../types";
import { searchUsers } from "../../api/organizers";
import { usersApi, groupsApi } from "../../api/eventumApi";
import { createParticipant, updateParticipant } from "../../api/participant";
import LazyImage from "../LazyImage";
import SuggestPickInput from "../SuggestPickInput";
import { useAdminData } from "../../contexts/AdminDataContext";
import { createEventumGroupGraphFromRaw } from "../../utils/eventumGroupGraphFromRaw";

type ParticipantModalTab = "general" | "groups" | "events";

function formatEventWhenShort(ev: Event) {
  try {
    return new Date(ev.start_time).toLocaleString("ru-RU", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return ev.start_time;
  }
}

interface ParticipantModalProps {
  isOpen: boolean;
  onClose: () => void;
  participant?: Participant | null;
  participantGroups?: ParticipantGroup[];
  /** Не-event группы (для добавления в участника) */
  availableGroups?: ParticipantGroup[];
  eventumSlug: string | null;
  onAfterMutate: () => Promise<void>;
  onParticipantCreated?: (participant: Participant) => void;
}

const ParticipantModal = ({
  isOpen,
  onClose,
  participant,
  participantGroups = [],
  availableGroups = [],
  eventumSlug,
  onAfterMutate,
  onParticipantCreated,
}: ParticipantModalProps) => {
  const [activeTab, setActiveTab] = useState<ParticipantModalTab>("general");
  const [name, setName] = useState("");
  const [isEditingName, setIsEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState("");
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [userSearchQuery, setUserSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<User[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const [showAddUserModal, setShowAddUserModal] = useState(false);
  const [currentParticipantGroups, setCurrentParticipantGroups] = useState<ParticipantGroup[]>([]);
  const [pendingSaves, setPendingSaves] = useState(0);
  const [addGroupSelectKey, setAddGroupSelectKey] = useState(0);
  const [addEventSelectKey, setAddEventSelectKey] = useState(0);
  const [addingGroup, setAddingGroup] = useState(false);
  const [addingEvent, setAddingEvent] = useState(false);
  const [removingGroupId, setRemovingGroupId] = useState<number | null>(null);
  const nameEditRef = useRef<HTMLDivElement>(null);

  const { groupStructureRaw, participants: allAdminParticipants, events: adminEvents } =
    useAdminData();

  const beginSave = useCallback(() => {
    setPendingSaves((n) => n + 1);
  }, []);
  const endSave = useCallback(() => {
    setPendingSaves((n) => Math.max(0, n - 1));
  }, []);

  const isBusy = pendingSaves > 0;

  const effectiveParticipant = participant;

  useEffect(() => {
    if (!isOpen) {
      setActiveTab("general");
      setIsEditingName(false);
      setAddingGroup(false);
      setAddingEvent(false);
      setRemovingGroupId(null);
      return;
    }
    if (participant) {
      setIsEditingName(false);
      setName(participant.name);
      setNameDraft(participant.name);
      setSelectedUser(participant.user || null);
      setUserSearchQuery(participant.user?.name || "");
      setCurrentParticipantGroups(participantGroups);
    } else {
      setName("");
      setNameDraft("");
      setSelectedUser(null);
      setUserSearchQuery("");
      setCurrentParticipantGroups([]);
      setIsEditingName(true);
    }
  }, [participant, participantGroups, isOpen]);

  useEffect(() => {
    if (!userSearchQuery.trim() && selectedUser) {
      setSelectedUser(null);
    }
  }, [userSearchQuery, selectedUser]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Element;
      if (!target.closest(".user-search-container")) {
        setShowUserDropdown(false);
      }
    };

    if (showUserDropdown) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [showUserDropdown]);

  useEffect(() => {
    if (!isOpen || !isEditingName) return;

    const exitIfUnchanged = (target: Node | null) => {
      if (!target || !nameEditRef.current?.contains(target)) {
        if (nameDraft.trim() === name.trim()) {
          setIsEditingName(false);
          setNameDraft(name);
        }
      }
    };

    const onPointerDown = (event: MouseEvent | TouchEvent) => {
      exitIfUnchanged(event.target as Node);
    };

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("touchstart", onPointerDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("touchstart", onPointerDown);
    };
  }, [isOpen, isEditingName, nameDraft, name]);

  const handleUserSearch = async (query: string) => {
    if (query.length < 2) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    try {
      const users = await searchUsers(query);
      setSearchResults(users);
      setShowUserDropdown(true);
    } catch (error) {
      console.error("Ошибка при поиске пользователей:", error);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  const persistUserId = async (userId: number | null) => {
    if (!eventumSlug || !effectiveParticipant?.id) return;
    beginSave();
    try {
      await updateParticipant(eventumSlug, effectiveParticipant.id, { user_id: userId });
      await onAfterMutate();
    } catch (error) {
      console.error("Ошибка при привязке VK:", error);
    } finally {
      endSave();
    }
  };

  const handleUserSelect = async (user: User) => {
    setSelectedUser(user);
    setUserSearchQuery(user.name);
    setShowUserDropdown(false);
    setSearchResults([]);
    await persistUserId(user.id);
  };

  const handleUserClear = async () => {
    setSelectedUser(null);
    setUserSearchQuery("");
    setShowUserDropdown(false);
    setSearchResults([]);
    await persistUserId(null);
  };

  const saveName = async () => {
    const trimmed = nameDraft.trim();
    if (!trimmed || !eventumSlug) return;

    beginSave();
    try {
      if (effectiveParticipant) {
        await updateParticipant(eventumSlug, effectiveParticipant.id, { name: trimmed });
        setName(trimmed);
        await onAfterMutate();
      } else {
        const created = await createParticipant(eventumSlug, {
          name: trimmed,
          user_id: undefined,
        });
        setName(trimmed);
        onParticipantCreated?.(created);
        await onAfterMutate();
      }
      setIsEditingName(false);
    } catch (error) {
      console.error("Ошибка при сохранении имени:", error);
    } finally {
      endSave();
    }
  };

  const startEditName = () => {
    setNameDraft(name);
    setIsEditingName(true);
  };

  const groupsToAdd = useMemo(() => {
    const ids = new Set(currentParticipantGroups.map((g) => g.id));
    return availableGroups.filter((g) => !g.is_event_group && !ids.has(g.id));
  }, [availableGroups, currentParticipantGroups]);

  const groupSuggestItems = useMemo(
    () => groupsToAdd.map((g) => ({ id: g.id, label: g.name })),
    [groupsToAdd]
  );

  const groupGraph = useMemo(() => {
    if (!groupStructureRaw) return null;
    const ids = new Set(allAdminParticipants.map((p) => p.id));
    return createEventumGroupGraphFromRaw(groupStructureRaw, ids);
  }, [groupStructureRaw, allAdminParticipants]);

  const { participantEventsList, eventsAvailableToAdd } = useMemo(() => {
    const pid = effectiveParticipant?.id;
    if (pid == null) {
      return { participantEventsList: [] as Event[], eventsAvailableToAdd: [] as Event[] };
    }
    const inList: Event[] = [];
    const addList: Event[] = [];
    for (const ev of adminEvents) {
      const gid = ev.event_group_id ?? null;
      if (gid == null) {
        inList.push(ev);
      } else if (!groupGraph) {
        continue;
      } else if (groupGraph.hasParticipant(gid, pid)) {
        inList.push(ev);
      } else {
        addList.push(ev);
      }
    }
    const byStart = (a: Event, b: Event) =>
      new Date(a.start_time).getTime() - new Date(b.start_time).getTime();
    inList.sort(byStart);
    addList.sort(byStart);
    return { participantEventsList: inList, eventsAvailableToAdd: addList };
  }, [effectiveParticipant?.id, groupGraph, adminEvents]);

  const eventSuggestItems = useMemo(
    () =>
      eventsAvailableToAdd.map((ev) => ({
        id: ev.id,
        label: ev.name,
        hint: formatEventWhenShort(ev),
      })),
    [eventsAvailableToAdd]
  );

  const applyGroupParticipantMutation = async (
    groupId: number,
    action: "add" | "remove",
    syncNonEventGroupsList: boolean
  ) => {
    if (!eventumSlug || !effectiveParticipant?.id) return;
    const group = availableGroups.find((g) => g.id === groupId);
    if (!group) return;
    const participantId = effectiveParticipant.id;

    beginSave();
    try {
      if (action === "remove") {
        const updatedRelations = group.participant_relations
          .filter((rel) => rel.participant_id !== participantId)
          .map((rel) => ({
            participant_id: rel.participant_id,
            relation_type: rel.relation_type,
          }));
        await groupsApi.update(groupId, { participant_relations: updatedRelations }, eventumSlug);
        if (syncNonEventGroupsList && !group.is_event_group) {
          setCurrentParticipantGroups((prev) => prev.filter((g) => g.id !== groupId));
        }
      } else {
        const existing = group.participant_relations.map((rel) => ({
          participant_id: rel.participant_id,
          relation_type: rel.relation_type,
        }));
        if (existing.some((r) => r.participant_id === participantId)) {
          endSave();
          return;
        }
        existing.push({ participant_id: participantId, relation_type: "inclusive" });
        await groupsApi.update(groupId, { participant_relations: existing }, eventumSlug);
        if (syncNonEventGroupsList && !group.is_event_group) {
          setCurrentParticipantGroups((prev) =>
            prev.some((g) => g.id === group.id) ? prev : [...prev, group]
          );
        }
      }
      setAddGroupSelectKey((k) => k + 1);
      setAddEventSelectKey((k) => k + 1);
      await onAfterMutate();
    } catch (error) {
      console.error(`Ошибка при обновлении группы ${groupId}:`, error);
      throw error;
    } finally {
      endSave();
    }
  };

  const handleRemoveGroup = async (groupId: number) => {
    const group = availableGroups.find((g) => g.id === groupId);
    if (!group || group.is_event_group) return;
    setRemovingGroupId(groupId);
    try {
      await applyGroupParticipantMutation(groupId, "remove", true);
    } catch {
      /* ошибка уже залогирована */
    } finally {
      setRemovingGroupId(null);
    }
  };

  const handleAddGroup = async (groupId: number) => {
    const group = availableGroups.find((g) => g.id === groupId);
    if (!group || group.is_event_group) return;
    setAddingGroup(true);
    try {
      await applyGroupParticipantMutation(groupId, "add", true);
    } finally {
      setAddingGroup(false);
    }
  };

  const handleAddParticipantToEvent = async (eventId: number) => {
    const ev = adminEvents.find((e) => e.id === eventId);
    const gid = ev?.event_group_id;
    if (gid == null) return;
    setAddingEvent(true);
    try {
      await applyGroupParticipantMutation(gid, "add", false);
    } finally {
      setAddingEvent(false);
    }
  };

  const handleClose = () => {
    if (!isBusy) {
      onClose();
    }
  };

  const canUseVk = !!effectiveParticipant?.id;
  const showCreateHint = !effectiveParticipant;

  if (!isOpen) return null;

  const displayName = name.trim() || "Новый участник";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="flex w-full max-w-lg max-h-[90vh] flex-col rounded-xl bg-white shadow-xl">
        <div className="flex shrink-0 items-start gap-4 border-b border-gray-100 px-5 pt-5 pb-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-full bg-gray-100">
            {effectiveParticipant?.user?.avatar_url ? (
              <LazyImage
                src={effectiveParticipant.user.avatar_url}
                alt={displayName}
                className="h-full w-full rounded-full object-cover"
                fallbackComponent={<IconUser size={28} className="text-gray-400" />}
              />
            ) : (
              <IconUser size={28} className="text-gray-400" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            {isEditingName ? (
              <div ref={nameEditRef} className="flex items-center gap-2">
                <input
                  type="text"
                  value={nameDraft}
                  onChange={(e) => setNameDraft(e.target.value)}
                  disabled={isBusy}
                  autoFocus
                  className="min-w-0 flex-1 rounded-lg border border-gray-300 px-3 py-1.5 text-lg font-semibold text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200 disabled:bg-gray-50"
                  placeholder="Имя участника"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") void saveName();
                    if (e.key === "Escape") {
                      setIsEditingName(false);
                      setNameDraft(name);
                    }
                  }}
                />
                <button
                  type="button"
                  onClick={() => void saveName()}
                  disabled={isBusy || !nameDraft.trim()}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
                  title="Сохранить имя"
                >
                  <IconCheck size={18} />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={startEditName}
                className="group flex w-full items-center gap-2 text-left"
              >
                <h2 className="truncate text-lg font-semibold text-gray-900 group-hover:text-blue-700">
                  {displayName}
                </h2>
                <IconPencil
                  size={18}
                  className="shrink-0 text-gray-400 opacity-0 transition group-hover:opacity-100"
                />
              </button>
            )}
            {showCreateHint && (
              <p className="mt-1 text-xs text-gray-500">
                Укажите имя и нажмите галочку, чтобы создать участника.
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={handleClose}
            disabled={isBusy}
            className="shrink-0 rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 disabled:opacity-50"
            aria-label="Закрыть"
          >
            <IconX size={20} />
          </button>
        </div>

        <div className="shrink-0 border-b border-gray-100 px-5">
          <nav className="-mb-px flex gap-4" aria-label="Вкладки">
            <button
              type="button"
              onClick={() => setActiveTab("general")}
              className={`border-b-2 px-1 py-3 text-sm font-medium transition ${
                activeTab === "general"
                  ? "border-blue-600 text-blue-600"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              Общее
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("groups")}
              disabled={!effectiveParticipant}
              className={`border-b-2 px-1 py-3 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-40 ${
                activeTab === "groups"
                  ? "border-blue-600 text-blue-600"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              Группы
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("events")}
              disabled={!effectiveParticipant}
              className={`border-b-2 px-1 py-3 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-40 ${
                activeTab === "events"
                  ? "border-blue-600 text-blue-600"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              Мероприятия
            </button>
          </nav>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 pt-4 pb-6">
          {activeTab === "general" && (
            <div className="space-y-4">
              {!canUseVk && (
                <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900">
                  Привязка VK будет доступна после сохранения имени участника.
                </p>
              )}
              <div className={`relative user-search-container ${!canUseVk ? "pointer-events-none opacity-50" : ""}`}>
                <div className="mb-1 flex items-center justify-between">
                  <label htmlFor="user-search" className="block text-sm font-medium text-gray-700">
                    VK
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowAddUserModal(true)}
                    disabled={isBusy || !canUseVk}
                    className="text-xs text-blue-600 hover:text-blue-800 disabled:opacity-50"
                  >
                    + Добавить VK пользователя
                  </button>
                </div>
                <div className="relative">
                  <input
                    id="user-search"
                    type="text"
                    value={userSearchQuery}
                    onChange={(e) => {
                      const value = e.target.value;
                      setUserSearchQuery(value);
                      if (!value.trim()) {
                        setSelectedUser(null);
                        setSearchResults([]);
                        setShowUserDropdown(false);
                        return;
                      }
                      if (selectedUser && value !== selectedUser.name) {
                        setSelectedUser(null);
                      }
                      void handleUserSearch(value);
                    }}
                    onFocus={() => canUseVk && setShowUserDropdown(true)}
                    disabled={isBusy || !canUseVk}
                    className={`w-full rounded-lg border px-3 py-2 pr-10 text-sm focus:outline-none focus:ring-2 disabled:bg-gray-50 ${
                      selectedUser
                        ? "border-green-300 bg-green-50 focus:border-green-500 focus:ring-green-200"
                        : "border-gray-300 focus:border-blue-500 focus:ring-blue-200"
                    }`}
                    placeholder="Поиск пользователя по имени..."
                  />
                  <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3">
                    {isSearching ? (
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
                    ) : (
                      <IconSearch size={16} className="text-gray-400" />
                    )}
                  </div>

                  {(selectedUser || userSearchQuery) && canUseVk && (
                    <button
                      type="button"
                      onClick={() => void handleUserClear()}
                      className="absolute right-8 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      <IconX size={16} />
                    </button>
                  )}
                </div>

                {showUserDropdown && canUseVk && (searchResults.length > 0 || selectedUser) && (
                  <div className="absolute z-10 mt-1 max-h-60 w-full overflow-y-auto rounded-lg border border-gray-300 bg-white shadow-lg">
                    {selectedUser && (
                      <button
                        type="button"
                        onClick={() => void handleUserClear()}
                        className="flex w-full items-center gap-3 border-b border-gray-200 px-4 py-2 text-left text-sm text-gray-500 hover:bg-gray-100"
                      >
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-100">
                          <IconX size={16} />
                        </div>
                        <div className="flex-1">
                          <div className="font-medium">Очистить выбор</div>
                          <div className="text-xs">Отвязать пользователя</div>
                        </div>
                      </button>
                    )}

                    {selectedUser && !searchResults.some((user) => user.id === selectedUser.id) && (
                      <button
                        type="button"
                        onClick={() => void handleUserSelect(selectedUser)}
                        className="flex w-full items-center gap-3 border-l-4 border-blue-500 bg-blue-50 px-4 py-2 text-left text-sm hover:bg-blue-100"
                      >
                        <div className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full bg-gray-200">
                          {selectedUser.avatar_url ? (
                            <img
                              src={selectedUser.avatar_url}
                              alt={selectedUser.name}
                              className="h-8 w-8 rounded-full object-cover"
                            />
                          ) : (
                            <IconUser size={16} className="text-gray-500" />
                          )}
                        </div>
                        <div className="flex-1">
                          <div className="font-medium text-gray-900">{selectedUser.name}</div>
                          <div className="text-xs text-gray-500">VK ID: {selectedUser.vk_id}</div>
                        </div>
                        <IconCheck size={16} className="text-blue-600" />
                      </button>
                    )}

                    {searchResults.map((user) => (
                      <button
                        key={user.id}
                        type="button"
                        onClick={() => void handleUserSelect(user)}
                        className={`flex w-full items-center gap-3 px-4 py-2 text-left text-sm hover:bg-gray-100 ${
                          selectedUser?.id === user.id ? "border-l-4 border-blue-500 bg-blue-50" : ""
                        }`}
                      >
                        <div className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full bg-gray-200">
                          {user.avatar_url ? (
                            <img
                              src={user.avatar_url}
                              alt={user.name}
                              className="h-8 w-8 rounded-full object-cover"
                            />
                          ) : (
                            <IconUser size={16} className="text-gray-500" />
                          )}
                        </div>
                        <div className="flex-1">
                          <div className="font-medium text-gray-900">{user.name}</div>
                          <div className="text-xs text-gray-500">VK ID: {user.vk_id}</div>
                        </div>
                        {selectedUser?.id === user.id && <IconCheck size={16} className="text-blue-600" />}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === "groups" && effectiveParticipant && (
            <div className="space-y-4">
              {groupsToAdd.length > 0 && (
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">Добавить в группу</label>
                  <div className="flex gap-2">
                    <SuggestPickInput
                      key={addGroupSelectKey}
                      items={groupSuggestItems}
                      onPick={(id) => handleAddGroup(id)}
                      disabled={isBusy}
                      loading={addingGroup}
                      placeholder="Введите название группы для поиска…"
                    />
                    <span className="flex w-9 shrink-0 items-center justify-center text-gray-400">
                      {addingGroup ? (
                        <div
                          className="h-5 w-5 animate-spin rounded-full border-2 border-blue-500 border-t-transparent"
                          aria-hidden
                        />
                      ) : (
                        <IconPlus size={18} />
                      )}
                    </span>
                  </div>
                </div>
              )}

              <div>
                <p className="mb-2 text-sm font-medium text-gray-700">Группы участника</p>
                {currentParticipantGroups.length === 0 ? (
                  <p className="rounded-lg border border-dashed border-gray-200 bg-gray-50 px-3 py-6 text-center text-sm text-gray-500">
                    Нет групп (группы мероприятий здесь не показываются)
                  </p>
                ) : (
                  <ul className="space-y-2">
                    {currentParticipantGroups.map((group) => (
                      <li
                        key={group.id}
                        className="flex items-center gap-2 rounded-lg border border-gray-100 bg-gray-50 px-3 py-2 text-sm"
                      >
                        <span className="flex-1 text-gray-900">{group.name}</span>
                        <button
                          type="button"
                          onClick={() => void handleRemoveGroup(group.id)}
                          disabled={isBusy || removingGroupId !== null}
                          className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 hover:bg-white hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-50"
                          aria-label={`Удалить из группы ${group.name}`}
                        >
                          {removingGroupId === group.id ? (
                            <div
                              className="h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-gray-600"
                              aria-hidden
                            />
                          ) : (
                            <IconX size={16} />
                          )}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}

          {activeTab === "events" && effectiveParticipant && (
            <div className="space-y-4">
              {!groupStructureRaw && (
                <p className="rounded-lg bg-gray-50 px-3 py-2 text-sm text-gray-600">
                  Загружаем сырые данные графа групп…
                </p>
              )}
              {eventsAvailableToAdd.length > 0 && (
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">
                    Добавить в мероприятие
                  </label>
                  <p className="mb-2 text-xs text-gray-500">
                    Доступны только мероприятия со своей группой участников. Общие мероприятия (без группы)
                    уже включают всех.
                  </p>
                  <div className="flex gap-2">
                    <SuggestPickInput
                      key={addEventSelectKey}
                      items={eventSuggestItems}
                      onPick={(id) => handleAddParticipantToEvent(id)}
                      disabled={isBusy}
                      loading={addingEvent}
                      placeholder="Введите название мероприятия для поиска…"
                    />
                    <span className="flex w-9 shrink-0 items-center justify-center text-gray-400">
                      {addingEvent ? (
                        <div
                          className="h-5 w-5 animate-spin rounded-full border-2 border-blue-500 border-t-transparent"
                          aria-hidden
                        />
                      ) : (
                        <IconPlus size={18} />
                      )}
                    </span>
                  </div>
                </div>
              )}

              <div>
                <p className="mb-2 text-sm font-medium text-gray-700">
                  Мероприятия участника
                </p>
                {participantEventsList.length === 0 ? (
                  <p className="rounded-lg border border-dashed border-gray-200 bg-gray-50 px-3 py-6 text-center text-sm text-gray-500">
                    Нет мероприятий по правилам event_group (и общих в eventum)
                  </p>
                ) : (
                  <ul className="space-y-2">
                    {participantEventsList.map((ev) => {
                      const isOpenToAll = ev.event_group_id == null;
                      const when = formatEventWhenShort(ev);
                      return (
                        <li
                          key={ev.id}
                          className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2 text-sm"
                        >
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-medium text-gray-900">{ev.name}</span>
                            {isOpenToAll && (
                              <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs text-emerald-800">
                                Общее
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-gray-500">{when}</div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {showAddUserModal && (
        <AddVKUserModal
          isOpen={showAddUserModal}
          onClose={() => setShowAddUserModal(false)}
          onUserCreated={(user) => {
            setShowAddUserModal(false);
            void handleUserSelect(user);
          }}
        />
      )}
    </div>
  );
};

interface AddVKUserModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUserCreated: (user: User) => void;
}

const AddVKUserModal = ({ isOpen, onClose, onUserCreated }: AddVKUserModalProps) => {
  const [userName, setUserName] = useState("");
  const [vkId, setVkId] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<{ name?: string; vk_id?: string }>({});

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userName.trim() || !vkId.trim()) return;

    setIsLoading(true);
    setError("");
    setFieldErrors({});

    try {
      const newUser = await usersApi.create({
        name: userName.trim(),
        vk_id: parseInt(vkId, 10),
      });
      onUserCreated(newUser.data);
    } catch (error: unknown) {
      console.error("Ошибка при создании пользователя:", error);
      const err = error as {
        response?: { data?: Record<string, unknown> };
        message?: string;
      };
      if (err?.response?.data) {
        const errorData = err.response.data as Record<string, string | string[]>;

        if (errorData.vk_id) {
          const vkIdError = Array.isArray(errorData.vk_id) ? errorData.vk_id[0] : errorData.vk_id;
          if (typeof vkIdError === "string" && vkIdError.includes("already exists")) {
            setFieldErrors({ vk_id: "Пользователь с таким VK ID уже существует" });
          } else {
            setFieldErrors({ vk_id: vkIdError });
          }
        }

        if (errorData.name) {
          const nameError = Array.isArray(errorData.name) ? errorData.name[0] : errorData.name;
          setFieldErrors((prev) => ({ ...prev, name: nameError }));
        }

        if (errorData.detail) {
          setError(String(errorData.detail));
        } else if (errorData.non_field_errors) {
          setError(
            Array.isArray(errorData.non_field_errors)
              ? errorData.non_field_errors.join(", ")
              : String(errorData.non_field_errors)
          );
        } else if (!errorData.vk_id && !errorData.name) {
          setError("Ошибка при создании пользователя");
        }
      } else if (err?.message) {
        setError(err.message);
      } else {
        setError("Ошибка при создании пользователя");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    if (!isLoading) {
      setUserName("");
      setVkId("");
      setError("");
      setFieldErrors({});
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">Добавить VK пользователя</h3>
          <button
            type="button"
            onClick={handleClose}
            disabled={isLoading}
            className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 disabled:opacity-50"
          >
            <IconX size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="user-name" className="mb-1 block text-sm font-medium text-gray-700">
              Имя пользователя *
            </label>
            <input
              id="user-name"
              type="text"
              value={userName}
              onChange={(e) => {
                setUserName(e.target.value);
                if (fieldErrors.name) {
                  setFieldErrors((prev) => ({ ...prev, name: undefined }));
                }
              }}
              required
              disabled={isLoading}
              className={`w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 disabled:bg-gray-50 ${
                fieldErrors.name
                  ? "border-red-300 focus:border-red-500 focus:ring-red-200"
                  : "border-gray-300 focus:border-blue-500 focus:ring-blue-200"
              }`}
              placeholder="Введите имя пользователя"
            />
            {fieldErrors.name && <p className="mt-1 text-sm text-red-600">{fieldErrors.name}</p>}
          </div>

          <div>
            <label htmlFor="vk-id" className="mb-1 block text-sm font-medium text-gray-700">
              VK ID *
            </label>
            <input
              id="vk-id"
              type="number"
              value={vkId}
              onChange={(e) => {
                setVkId(e.target.value);
                if (fieldErrors.vk_id) {
                  setFieldErrors((prev) => ({ ...prev, vk_id: undefined }));
                }
              }}
              required
              disabled={isLoading}
              className={`w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 disabled:bg-gray-50 ${
                fieldErrors.vk_id
                  ? "border-red-300 focus:border-red-500 focus:ring-red-200"
                  : "border-gray-300 focus:border-blue-500 focus:ring-blue-200"
              }`}
              placeholder="Введите VK ID"
            />
            {fieldErrors.vk_id && <p className="mt-1 text-sm text-red-600">{fieldErrors.vk_id}</p>}
          </div>

          {error && <div className="rounded-lg bg-red-50 p-3 text-sm text-red-600">{error}</div>}

          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={handleClose}
              disabled={isLoading}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              Отмена
            </button>
            <button
              type="submit"
              disabled={isLoading || !userName.trim() || !vkId.trim()}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {isLoading ? "Создание…" : "Создать"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ParticipantModal;
