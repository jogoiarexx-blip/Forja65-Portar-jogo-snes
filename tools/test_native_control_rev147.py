#!/usr/bin/env python3
"""Protocol regression independent from the game; fork determinism via verify_fork_replay_rev147.py."""
import unittest
from unittest.mock import Mock
from native_control_client_rev147 import PortEmu

class ProtocolTests(unittest.TestCase):
    def test_restored_pid_can_exit_without_breaking_client(self):
        e=PortEmu.__new__(PortEmu)
        e.restored_from_fork=True;e.p=Mock();e.p.stdin=Mock();e.p.stdout.readline.return_value='ok 211\n'
        e.p.poll.return_value=0
        self.assertEqual(e.cmd('frame'),'ok 211')
        e.p.stdin.write.assert_called_once_with('frame\n')
    def test_unrestored_exited_pid_is_error(self):
        e=PortEmu.__new__(PortEmu)
        e.restored_from_fork=False;e.p=Mock();e.p.poll.return_value=1;e.p.returncode=1;e.stderr_path='/tmp/port-err'
        with self.assertRaisesRegex(RuntimeError,'exited'):
            e.cmd('frame')
    def test_load_error_does_not_enter_restored_state(self):
        e=PortEmu.__new__(PortEmu)
        e.restored_from_fork=False;e.p=Mock();e.p.poll.return_value=None;e.p.stdout.readline.return_value='err\n'
        with self.assertRaisesRegex(RuntimeError,'rejected'):
            e.load('missing')
        self.assertFalse(e.restored_from_fork)
    def test_load_success_rebinds(self):
        e=PortEmu.__new__(PortEmu)
        e.restored_from_fork=False;e.p=Mock();e.p.poll.return_value=None;e.p.stdout.readline.return_value='ok 100\n'
        self.assertEqual(e.load('s'),'ok 100')
        self.assertTrue(e.restored_from_fork)
if __name__=='__main__':unittest.main()
