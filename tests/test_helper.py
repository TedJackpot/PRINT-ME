import ctypes
import importlib.util
import unittest
from unittest.mock import patch
spec = importlib.util.spec_from_file_location('helper', 'helper/printme_helper.py')
helper = importlib.util.module_from_spec(spec)
spec.loader.exec_module(helper)

class Spooler:
    def __init__(self, fail=False):
        self.output = bytearray()
        self.aborted = False
        self.closed = False
        self.fail = fail
    def OpenPrinterW(self, name, handle, defaults):
        handle._obj.value = 0x123456789
        return True
    def StartDocPrinterW(self, *args): return 42
    def StartPagePrinter(self, *args): return True
    def WritePrinter(self, handle, data, size, written):
        if self.fail: return False
        count = min(size, 7)  # le spooler peut accepter un bloc partiel
        self.output.extend(data[:count]); written._obj.value = count
        return True
    def EndPagePrinter(self, *args): return True
    def EndDocPrinter(self, *args): return True
    def AbortPrinter(self, *args): self.aborted = True
    def ClosePrinter(self, *args): self.closed = True

class Tests(unittest.TestCase):
    def test_partial_writes(self):
        spooler = Spooler()
        with patch.object(helper, 'winspool', spooler):
            self.assertEqual(helper.raw_print('TS-M420', b'abcdef0123456789'), 42)
        self.assertEqual(spooler.output, b'abcdef0123456789')
        self.assertTrue(spooler.closed)
    def test_failure_aborts(self):
        spooler = Spooler(fail=True)
        with patch.object(helper, 'winspool', spooler), patch.object(ctypes, 'get_last_error', return_value=5, create=True):
            with self.assertRaises(OSError): helper.raw_print('TS-M420', b'abc')
        self.assertTrue(spooler.aborted)
        self.assertTrue(spooler.closed)
    def test_origin_check(self):
        self.assertTrue(helper.origin_allowed('http://localhost:8080'))
        self.assertFalse(helper.origin_allowed('https://evil.example'))
        self.assertFalse(helper.origin_allowed('http://localhost.evil.example'))
    def test_driver_is_not_a_diagnosis(self):
        self.assertFalse(helper.driver_detruit_les_commandes('Generic / Text Only'))

if __name__ == '__main__': unittest.main()
