import React, { useMemo, useState } from 'react';
import { DndContext, DragOverlay, PointerSensor, closestCenter, useDroppable, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { KANBAN_COLUMNS, formatDuration, getTrackedSeconds, getWorkflowStage } from '../../utils/workManagement';

function TaskCardItem({ task, activeTimerTaskId, savingTimer, onStartTimer, onStopTimer, dragOverlay }) {
  var sortable = useSortable({ id: task._id, data: { type: 'task', stage: getWorkflowStage(task) } });
  var style = {
    transform: CSS.Transform.toString(sortable.transform),
    transition: sortable.transition,
    opacity: sortable.isDragging && !dragOverlay ? 0.35 : 1,
  };
  var tracked = getTrackedSeconds(task);
  var isActiveTimer = activeTimerTaskId === task._id;

  function handleAction(event, callback) {
    event.preventDefault();
    event.stopPropagation();
    if (callback) callback();
  }

  return (
    <article
      ref={sortable.setNodeRef}
      style={style}
      {...sortable.attributes}
      {...(dragOverlay ? {} : sortable.listeners)}
      className={'wm-kanban-card' + (sortable.isDragging && !dragOverlay ? ' wm-kanban-card--dragging' : '') + (dragOverlay ? ' wm-kanban-card--overlay' : '')}
    >
      <div className="wm-kanban-card__top">
        <strong>{task.title}</strong>
        <span className={'wm-priority-pill wm-priority-pill--' + (task.priority || 'medium')}>{task.priority || 'medium'}</span>
      </div>
      {task.description ? <p>{task.description}</p> : null}
      <div className="wm-kanban-card__meta">
        <span>{task?.assignee?.name || 'Unassigned'}</span>
        {task?.dueDate ? <span>{new Date(task.dueDate).toLocaleDateString()}</span> : null}
      </div>
      <div className="wm-kanban-card__footer">
        <span>Progress {Number(task?.progress || (task?.status === 'done' ? 100 : 0))}%</span>
        <span>Tracked {formatDuration(tracked)}</span>
      </div>
      <div className="wm-kanban-card__actions">
        {isActiveTimer ? (
          <button
            type="button"
            className="btn btn--primary btn--sm"
            disabled={savingTimer}
            onPointerDown={function (event) { event.stopPropagation(); }}
            onClick={function (event) { handleAction(event, onStopTimer); }}
          >
            {savingTimer ? 'Saving...' : 'Stop Timer'}
          </button>
        ) : (
          <>
            <button
              type="button"
              className="btn btn--secondary btn--sm"
              onPointerDown={function (event) { event.stopPropagation(); }}
              onClick={function (event) { handleAction(event, function () { onStartTimer(task, false); }); }}
            >
              Start Timer
            </button>
            <button
              type="button"
              className="btn btn--ghost btn--sm"
              onPointerDown={function (event) { event.stopPropagation(); }}
              onClick={function (event) { handleAction(event, function () { onStartTimer(task, true); }); }}
            >
              Focus
            </button>
          </>
        )}
      </div>
    </article>
  );
}

function Column({ column, tasks, activeTimerTaskId, savingTimer, onStartTimer, onStopTimer }) {
  var droppable = useDroppable({ id: column.key, data: { stage: column.key } });
  return (
    <section
      ref={droppable.setNodeRef}
      className={'wm-kanban-column' + (droppable.isOver ? ' wm-kanban-column--over' : '')}
      data-column={column.key}
    >
      <header className="wm-kanban-column__header">
        <div>
          <h3>{column.label}</h3>
          <p>{tasks.length} tasks</p>
        </div>
      </header>
      <SortableContext items={tasks.map(function (task) { return task._id; })} strategy={verticalListSortingStrategy}>
        <div className="wm-kanban-column__body">
          {tasks.length === 0 ? (
            <div className="wm-kanban-column__empty">Drop work here</div>
          ) : (
            tasks.map(function (task) {
              return (
                <TaskCardItem
                  key={task._id}
                  task={task}
                  activeTimerTaskId={activeTimerTaskId}
                  savingTimer={savingTimer}
                  onStartTimer={onStartTimer}
                  onStopTimer={onStopTimer}
                />
              );
            })
          )}
        </div>
      </SortableContext>
    </section>
  );
}

function KanbanBoard({ tasks, onMoveTask, activeTimerTaskId, savingTimer, onStartTimer, onStopTimer }) {
  var sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));
  var [activeTaskId, setActiveTaskId] = useState('');

  var groupedTasks = useMemo(function () {
    var grouped = KANBAN_COLUMNS.reduce(function (accumulator, column) {
      accumulator[column.key] = [];
      return accumulator;
    }, {});

    (tasks || []).forEach(function (task) {
      var stage = getWorkflowStage(task);
      if (!grouped[stage]) grouped.todo.push(task);
      else grouped[stage].push(task);
    });

    return grouped;
  }, [tasks]);

  var activeTask = useMemo(function () {
    return (tasks || []).find(function (task) { return task._id === activeTaskId; }) || null;
  }, [activeTaskId, tasks]);

  function handleDragStart(event) {
    setActiveTaskId(String(event.active?.id || ''));
  }

  function handleDragEnd(event) {
    var activeId = event.active?.id;
    setActiveTaskId('');
    if (!activeId) return;

    var nextStage = event.over?.data?.current?.stage || event.over?.id;
    if (!nextStage) return;

    var validStage = KANBAN_COLUMNS.some(function (column) { return column.key === nextStage; });
    if (!validStage) return;

    onMoveTask(String(activeId), nextStage);
  }

  function handleDragCancel() {
    setActiveTaskId('');
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <div className="wm-kanban-board">
        {KANBAN_COLUMNS.map(function (column) {
          return (
            <Column
              key={column.key}
              column={column}
              tasks={groupedTasks[column.key] || []}
              activeTimerTaskId={activeTimerTaskId}
              savingTimer={savingTimer}
              onStartTimer={onStartTimer}
              onStopTimer={onStopTimer}
            />
          );
        })}
      </div>
      <DragOverlay dropAnimation={{ duration: 220, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' }}>
        {activeTask ? (
          <TaskCardItem
            task={activeTask}
            activeTimerTaskId={activeTimerTaskId}
            savingTimer={savingTimer}
            onStartTimer={onStartTimer}
            onStopTimer={onStopTimer}
            dragOverlay={true}
          />
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

export default React.memo(KanbanBoard);
