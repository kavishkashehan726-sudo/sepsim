# SEPSim trace kit: records every SEP signal, every half clock, for each test program.
# Started by run_traces.bat as:  vsim -c -do "set sepdir {...}; do trace_all.do"
# It drives the model the same way SEPSim Beta does: force the architecture,
# force a 50 ns clock, load the .mem into /processor/as_ram/asram, then run.

onerror {resume}
transcript file trace_transcript.log

quietly set kitdir [pwd]
quietly set outdir [file join $kitdir out]
file mkdir $outdir
quietly set errlog [open [file join $outdir errors.txt] w]

proc load_design {} {
    global sepdir
    set workdir [file join $sepdir work]
    if {[catch {vmap sep $workdir} msg]} {
        error "could not map SEP library at $workdir: $msg"
    }
    vsim -quiet sep.processor
}

proc signal_list {} {
    global sepdir
    if {![catch {find signals -r /processor/*} sigs] && [llength $sigs] > 0} {
        return $sigs
    }
    # Fallback: the list SEPSim itself uses
    set sigs {}
    set f [open [file join $sepdir Signals.ini] r]
    while {[gets $f line] >= 0} {
        if {[regexp {^[0-9]+=(.+)$} [string trim $line] -> s]} { lappend sigs $s }
    }
    close $f
    return $sigs
}

proc sample {sigs} {
    if {![catch {eval [linsert $sigs 0 examine -radix binary]} vals] && [llength $vals] == [llength $sigs]} {
        return $vals
    }
    set vals {}
    foreach s $sigs {
        if {[catch {examine -radix binary $s} v]} { set v "?" }
        lappend vals $v
    }
    return $vals
}

proc trace_one {name memfile machine clocks} {
    global outdir
    load_design
    force -deposit /processor/machine $machine
    force -freeze /processor/clk 1 0, 0 {25 ns} -r 50 ns
    run 0 ns
    mem load -format bin -infile $memfile -filldata 0000000000000000 /processor/as_ram/asram

    set sigs [signal_list]
    set f [open [file join $outdir $name.trace] w]
    puts $f "# sepsim-trace v1"
    puts $f "program $name"
    puts $f "machine $machine"
    set i 0
    foreach s $sigs { puts $f "signal $i $s"; incr i }

    set prev [sample $sigs]
    puts $f "t 0"
    set i 0
    foreach v $prev { puts $f "v $i $v"; incr i }
    flush $f

    for {set c 1} {$c <= 2 * $clocks} {incr c} {
        run 25 ns
        set cur [sample $sigs]
        puts $f "t [expr {$c * 25}]"
        set i 0
        foreach v $cur p $prev {
            if {$v ne $p} { puts $f "v $i $v" }
            incr i
        }
        set prev $cur
        flush $f
    }
    close $f
    catch {mem save -outfile [file join $outdir $name.ram.mem] -format bin -wordsperline 20 /processor/as_ram/asram}
    catch {mem save -outfile [file join $outdir $name.cache.mem] -format bin -wordsperline 20 /processor/cache/storage}
    quit -sim
}

quietly set mf [open [file join $kitdir manifest.txt] r]
while {[gets $mf line] >= 0} {
    set line [string trim $line]
    if {$line eq "" || [string index $line 0] eq "#"} continue
    foreach {name machine clocks} $line break
    set memfile [file join $kitdir mem $name.mem]
    echo "=== tracing $name (machine $machine, $clocks clocks)"
    if {[catch {trace_one $name $memfile $machine $clocks} err]} {
        puts $errlog "$name: $err"
        flush $errlog
        catch {quit -sim}
    }
}
close $mf

# Any extra .mem files the user drops into the extra folder (traced as Accumulator)
foreach memfile [glob -nocomplain [file join $kitdir extra *.mem]] {
    set name "extra_[file rootname [file tail $memfile]]"
    echo "=== tracing $name"
    if {[catch {trace_one $name $memfile 101 400} err]} {
        puts $errlog "$name: $err"
        flush $errlog
        catch {quit -sim}
    }
}

close $errlog
echo "=== all done"
quit -f
