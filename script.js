document.addEventListener('DOMContentLoaded', () => {
    const addTaskBtn = document.getElementById('addTaskBtn');
    const tasksBody = document.getElementById('tasksBody');

    function nextIndex() {
        return tasksBody.querySelectorAll('.task-row').length;
    }

    function renumberRows() {
        tasksBody.querySelectorAll('.task-row').forEach((row, index) => {
            row.querySelectorAll('input, textarea').forEach((field) => {
                field.name = field.name.replace(/tasks\[\d+\]/, `tasks[${index}]`);
            });
        });
    }

    function createTaskRow(index) {
        const row = document.createElement('tr');
        row.className = 'task-row';
        row.innerHTML = `
            <td><input type="text" name="tasks[${index}][date]" placeholder="Apr 18, 2026" required></td>
            <td><input type="text" name="tasks[${index}][month]" placeholder="April" required></td>
            <td><input type="number" name="tasks[${index}][day]" placeholder="18" required></td>
            <td><textarea name="tasks[${index}][details]" rows="4" placeholder="• Activity detail one\n• Activity detail two" required></textarea></td>
            <td><input type="number" name="tasks[${index}][hours]" value="1" min="0" step="0.25" required></td>
            <td><button type="button" class="icon-btn remove-row" title="Remove row">×</button></td>
        `;
        return row;
    }

    addTaskBtn.addEventListener('click', () => {
        tasksBody.appendChild(createTaskRow(nextIndex()));
    });

    tasksBody.addEventListener('click', (event) => {
        if (!event.target.classList.contains('remove-row')) {
            return;
        }

        const rows = tasksBody.querySelectorAll('.task-row');
        if (rows.length === 1) {
            alert('At least one task row is required.');
            return;
        }

        event.target.closest('.task-row').remove();
        renumberRows();
    });
});
