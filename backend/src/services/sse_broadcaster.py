import asyncio
from collections import defaultdict
from typing import DefaultDict, Set


class SSEBroadcaster:
    """
    In-memory pub/sub broadcaster for Server-Sent Events (SSE).
    Avoids polling the database continuously by waking up client streams
    only when queue state transitions occur.
    """

    def __init__(self) -> None:
        # branch_id -> set of active client asyncio.Queue listeners
        self._subscribers: DefaultDict[int, Set[asyncio.Queue]] = defaultdict(set)

    def subscribe(self, branch_id: int) -> asyncio.Queue:
        """Register a new SSE client queue listener for a specific branch."""
        q: asyncio.Queue = asyncio.Queue(maxsize=50)
        self._subscribers[branch_id].add(q)
        return q

    def unsubscribe(self, branch_id: int, q: asyncio.Queue) -> None:
        """Deregister an SSE client queue listener."""
        self._subscribers[branch_id].discard(q)
        if not self._subscribers[branch_id]:
            self._subscribers.pop(branch_id, None)

    def notify_branch(self, branch_id: int) -> None:
        """
        Synchronously notify all active SSE listeners of a branch that a queue update occurred.
        Safe to call from synchronous service methods.
        """
        subscribers = list(self._subscribers.get(branch_id, []))
        for q in subscribers:
            try:
                q.put_nowait(True)
            except (asyncio.QueueFull, Exception):
                pass


broadcaster = SSEBroadcaster()
